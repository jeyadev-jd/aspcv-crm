import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { appendEvent } from '../services/timeline'
import { notifyRoles } from '../services/notify'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const DEFAULT_TAX_PERCENT = 18

const quotationItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  unitPrice: z.number().optional(),
  amount: z.number().optional(),
})

const quotationSchema = z.object({
  companyId: z.string().min(1),
  dealId: z.string().optional(),
  title: z.string().min(1),
  contactName: z.string().optional(),
  validUntil: z.string().optional(),
  warrantyPeriod: z.number().optional(),
  deliveryDate: z.string().optional(),
  scope: z.string().optional(),
  notes: z.string().optional(),
  taxPercent: z.number().optional(),
  status: z.string().optional(),
  totalAmount: z.number().optional(),
  items: z.array(quotationItemSchema).optional(),
})

function computeTotals(items: z.infer<typeof quotationItemSchema>[], taxPercent: number) {
  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0)
  const totalAmount = subtotal * (1 + taxPercent / 100)
  return { subtotal, totalAmount }
}

router.get('/', requirePermission('quotation', 'read_all'), async (req, res) => {
  try {
    const { dealId } = req.query
    const quotations = await prisma.quotation.findMany({
      where: dealId ? { dealId: String(dealId) } : {},
      include: { company: { select: { id: true, name: true } }, items: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(quotations)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch quotations' }) }
})

router.get('/:id', requirePermission('quotation', 'read_all'), async (req, res) => {
  try {
    const q = await prisma.quotation.findUnique({
      where: { id: (req.params.id as string) },
      include: { company: true, items: true, projects: { select: { id: true, title: true, status: true } } },
    })
    if (!q) return res.status(404).json({ error: 'Not found' })
    res.json(q)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch quotation' }) }
})

router.post('/', requirePermission('quotation', 'create'), async (req: AuthRequest, res) => {
  try {
    const data = quotationSchema.parse(req.body)
    const items = data.items || []
    const taxPercent = data.taxPercent ?? DEFAULT_TAX_PERCENT
    // Real project cost is entered directly (no line-item breakdown) — items remain
    // supported for older callers, but a direct totalAmount takes precedence.
    const { subtotal, totalAmount } = items.length > 0
      ? computeTotals(items, taxPercent)
      : { subtotal: data.totalAmount ?? 0, totalAmount: data.totalAmount ?? 0 }
    const count = await prisma.quotation.count()
    const refNumber = `QT-${String(count + 1).padStart(4, '0')}`
    const q = await prisma.quotation.create({
      data: {
        refNumber, companyId: data.companyId, dealId: data.dealId, title: data.title, contactName: data.contactName,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        warrantyPeriod: data.warrantyPeriod, deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
        scope: data.scope, notes: data.notes, taxPercent, subtotal, totalAmount,
        createdById: req.user?.id,
        items: { create: items.map(i => ({ description: i.description, quantity: i.quantity || 1, unit: i.unit, unitPrice: i.unitPrice || 0, amount: i.amount || 0 })) },
      },
      include: { items: true },
    })
    await appendEvent('Quotation', q.id, 'CREATED', `Quotation "${q.refNumber}" created`, req.user?.id)
    res.status(201).json(q)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to create quotation' }) }
})

router.put('/:id', requirePermission('quotation', 'edit'), async (req: AuthRequest, res) => {
  try {
    const data = quotationSchema.partial().parse(req.body)
    const q = await prisma.$transaction(async tx => {
      let totals: { subtotal?: number; totalAmount?: number } = {}
      if (data.items) {
        await tx.quotationItem.deleteMany({ where: { quotationId: (req.params.id as string) } })
        await tx.quotationItem.createMany({ data: data.items.map(i => ({ quotationId: (req.params.id as string), description: i.description, quantity: i.quantity || 1, unit: i.unit, unitPrice: i.unitPrice || 0, amount: i.amount || 0 })) })
        const existing = await tx.quotation.findUniqueOrThrow({ where: { id: (req.params.id as string) } })
        const taxPercent = data.taxPercent ?? existing.taxPercent
        totals = computeTotals(data.items, taxPercent)
      } else if (data.totalAmount !== undefined) {
        totals = { subtotal: data.totalAmount, totalAmount: data.totalAmount }
      }
      return tx.quotation.update({
        where: { id: (req.params.id as string) },
        data: {
          title: data.title, contactName: data.contactName,
          validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
          warrantyPeriod: data.warrantyPeriod, deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
          scope: data.scope, notes: data.notes, taxPercent: data.taxPercent,
          ...totals,
        },
        include: { items: true },
      })
    })
    await appendEvent('Quotation', q.id, 'UPDATED', `Quotation "${q.refNumber}" updated`, req.user?.id)
    res.json(q)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to update quotation' }) }
})

// Sales submits a Draft for admin sign-off before it can be sent to the customer.
router.post('/:id/submit-for-approval', requirePermission('quotation', 'edit'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.quotation.findUnique({ where: { id: req.params.id as string } })
    if (!existing) { res.status(404).json({ error: 'Not found' }); return }
    if (existing.status !== 'Draft') { res.status(400).json({ error: 'Only a Draft quotation can be submitted for approval' }); return }
    const docCount = await prisma.attachment.count({ where: { entityType: 'Quotation', entityId: existing.id } })
    if (docCount === 0) { res.status(400).json({ error: 'Attach at least one document link before submitting for approval' }); return }
    const q = await prisma.quotation.update({ where: { id: req.params.id as string }, data: { status: 'PendingApproval' } })
    await appendEvent('Quotation', q.id, 'SUBMITTED_FOR_APPROVAL', `Quotation "${q.refNumber}" submitted for approval`, req.user?.id)
    await notifyRoles(['SuperAdmin', 'BusinessHead'], {
      type: 'quotation', severity: 'info',
      title: `Quotation awaiting approval: ${q.refNumber}`,
      message: `"${q.title}" needs sign-off before it can be sent to the customer.`,
      entityType: 'Quotation', entityId: q.id,
    })
    res.json(q)
  } catch (e) { res.status(500).json({ error: 'Failed to submit quotation for approval' }) }
})

// SuperAdmin/BusinessHead sign-off — required before the quotation can be sent.
router.post('/:id/approve', requirePermission('quotation', 'approve'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.quotation.findUnique({ where: { id: req.params.id as string } })
    if (!existing) { res.status(404).json({ error: 'Not found' }); return }
    if (existing.status !== 'PendingApproval') { res.status(400).json({ error: 'Only a quotation pending approval can be approved' }); return }
    const q = await prisma.quotation.update({
      where: { id: req.params.id as string },
      data: { status: 'Approved', approvedById: req.user!.id, approvedAt: new Date(), rejectionReason: null },
    })
    await appendEvent('Quotation', q.id, 'APPROVED', `Quotation "${q.refNumber}" approved by ${req.user!.id}`, req.user?.id)
    res.json(q)
  } catch (e) { res.status(500).json({ error: 'Failed to approve quotation' }) }
})

router.post('/:id/reject', requirePermission('quotation', 'approve'), async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body as { reason?: string }
    const existing = await prisma.quotation.findUnique({ where: { id: req.params.id as string } })
    if (!existing) { res.status(404).json({ error: 'Not found' }); return }
    if (existing.status !== 'PendingApproval') { res.status(400).json({ error: 'Only a quotation pending approval can be rejected' }); return }
    const q = await prisma.quotation.update({
      where: { id: req.params.id as string },
      data: { status: 'Draft', rejectionReason: reason?.trim() || 'Rejected by admin', approvedById: null, approvedAt: null },
    })
    await appendEvent('Quotation', q.id, 'REJECTED', `Quotation "${q.refNumber}" sent back to Draft: ${q.rejectionReason}`, req.user?.id)
    res.json(q)
  } catch (e) { res.status(500).json({ error: 'Failed to reject quotation' }) }
})

// Sales marks an Approved quotation as Sent to the customer — cannot skip approval.
router.post('/:id/send', requirePermission('quotation', 'edit'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.quotation.findUnique({ where: { id: req.params.id as string } })
    if (!existing) { res.status(404).json({ error: 'Not found' }); return }
    if (existing.status !== 'Approved') { res.status(400).json({ error: 'Quotation must be approved by an admin before it can be sent' }); return }
    const q = await prisma.quotation.update({ where: { id: req.params.id as string }, data: { status: 'Sent' } })
    await appendEvent('Quotation', q.id, 'SENT', `Quotation "${q.refNumber}" sent to customer`, req.user?.id)
    res.json(q)
  } catch (e) { res.status(500).json({ error: 'Failed to mark quotation sent' }) }
})

router.delete('/:id', requirePermission('quotation', 'delete'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.quotation.findUnique({
      where: { id: req.params.id as string },
      include: { projects: { select: { id: true } } },
    })
    if (!existing) { res.status(404).json({ error: 'Not found' }); return }
    if (existing.status === 'Accepted') {
      res.status(409).json({ error: 'Cannot delete an Accepted quotation — it is linked to a project.' })
      return
    }
    if (existing.projects.length > 0) {
      res.status(409).json({ error: 'Cannot delete a quotation that has a linked project.' })
      return
    }
    await prisma.quotation.delete({ where: { id: (req.params.id as string) } })
    await appendEvent('Quotation', existing.id, 'DELETED', `Quotation "${existing.refNumber}" deleted`, req.user?.id)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: 'Failed to delete quotation' }) }
})

export default router
