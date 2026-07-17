import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { appendEvent } from '../services/timeline'
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
  title: z.string().min(1),
  contactName: z.string().optional(),
  validUntil: z.string().optional(),
  warrantyPeriod: z.number().optional(),
  deliveryDate: z.string().optional(),
  scope: z.string().optional(),
  notes: z.string().optional(),
  taxPercent: z.number().optional(),
  status: z.string().optional(),
  items: z.array(quotationItemSchema).optional(),
})

function computeTotals(items: z.infer<typeof quotationItemSchema>[], taxPercent: number) {
  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0)
  const totalAmount = subtotal * (1 + taxPercent / 100)
  return { subtotal, totalAmount }
}

router.get('/', requirePermission('quotation', 'read_all'), async (req, res) => {
  try {
    const quotations = await prisma.quotation.findMany({
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
      include: { company: true, items: true, salesOrders: true },
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
    const { subtotal, totalAmount } = computeTotals(items, taxPercent)
    const count = await prisma.quotation.count()
    const refNumber = `QT-${String(count + 1).padStart(4, '0')}`
    const q = await prisma.quotation.create({
      data: {
        refNumber, companyId: data.companyId, title: data.title, contactName: data.contactName,
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
      }
      return tx.quotation.update({
        where: { id: (req.params.id as string) },
        data: {
          title: data.title, contactName: data.contactName,
          validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
          warrantyPeriod: data.warrantyPeriod, deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
          scope: data.scope, notes: data.notes, taxPercent: data.taxPercent, status: data.status as any,
          ...totals,
        },
        include: { items: true },
      })
    })
    await appendEvent('Quotation', q.id, 'UPDATED', `Quotation "${q.refNumber}" updated`, req.user?.id)
    res.json(q)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to update quotation' }) }
})

router.delete('/:id', requirePermission('quotation', 'delete'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.quotation.findUnique({ where: { id: req.params.id as string } })
    await prisma.quotation.delete({ where: { id: (req.params.id as string) } })
    if (existing) await appendEvent('Quotation', existing.id, 'DELETED', `Quotation "${existing.refNumber}" deleted`, req.user?.id)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: 'Failed to delete quotation — it may have linked sales orders' }) }
})

export default router
