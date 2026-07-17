import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const salesOrderSchema = z.object({
  companyId: z.string().min(1),
  quotationId: z.string().optional(),
  title: z.string().min(1),
  budget: z.number().optional(),
  warrantyPeriod: z.number().optional(),
  deliveryDate: z.string().optional(),
  scope: z.string().optional(),
  productDetails: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
})

router.get('/', requirePermission('sales_order', 'read_all'), async (req, res) => {
  try {
    const orders = await prisma.salesOrder.findMany({
      include: {
        company: { select: { id: true, name: true } },
        quotation: { select: { id: true, refNumber: true } },
        project: { select: { id: true, title: true, status: true } },
        handoverDoc: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(orders)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch sales orders' }) }
})

router.get('/:id', requirePermission('sales_order', 'read_all'), async (req, res) => {
  try {
    const so = await prisma.salesOrder.findUnique({
      where: { id: (req.params.id as string) },
      include: {
        company: true,
        quotation: { include: { items: true } },
        project: true,
        handoverDoc: true,
      },
    })
    if (!so) return res.status(404).json({ error: 'Not found' })
    res.json(so)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch sales order' }) }
})

router.post('/', requirePermission('sales_order', 'create'), async (req: AuthRequest, res) => {
  try {
    const data = salesOrderSchema.parse(req.body)
    const count = await prisma.salesOrder.count()
    const refNumber = `SO-${String(count + 1).padStart(4, '0')}`
    const so = await prisma.salesOrder.create({
      data: {
        refNumber, companyId: data.companyId, quotationId: data.quotationId, title: data.title,
        budget: data.budget, warrantyPeriod: data.warrantyPeriod,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
        scope: data.scope, productDetails: data.productDetails, notes: data.notes,
        createdById: req.user?.id,
      },
      include: { company: true, quotation: true },
    })
    res.status(201).json(so)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to create sales order' }) }
})

router.put('/:id', requirePermission('sales_order', 'edit'), async (req, res) => {
  try {
    const data = salesOrderSchema.partial().parse(req.body)
    const so = await prisma.salesOrder.update({
      where: { id: (req.params.id as string) },
      data: {
        title: data.title, budget: data.budget, warrantyPeriod: data.warrantyPeriod,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
        scope: data.scope, productDetails: data.productDetails, notes: data.notes, status: data.status as any,
      },
      include: { company: true, handoverDoc: true },
    })
    res.json(so)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to update sales order' }) }
})

// Mark as Won → auto-generate Handover Document
router.post('/:id/won', requirePermission('sales_order', 'approve'), async (req, res) => {
  try {
    const so = await prisma.salesOrder.findUnique({ where: { id: (req.params.id as string) }, include: { company: true } })
    if (!so) return res.status(404).json({ error: 'Not found' })
    if (so.status === 'Won') return res.status(400).json({ error: 'Already marked as Won' })

    const count = await prisma.handoverDocument.count()
    const refNumber = `HD-${String(count + 1).padStart(4, '0')}`

    const [updatedSO, handover] = await prisma.$transaction([
      prisma.salesOrder.update({
        where: { id: (req.params.id as string) },
        data: { status: 'Won', wonAt: new Date() },
      }),
      prisma.handoverDocument.create({
        data: {
          refNumber,
          salesOrderId: so.id,
          projectName: so.title,
          customerDetails: so.company?.name,
          budget: so.budget,
          warrantyPeriod: so.warrantyPeriod,
          productDetails: so.productDetails,
          deliveryDate: so.deliveryDate,
          scope: so.scope,
          notes: so.notes,
          status: 'pending',
        },
      }),
    ])

    res.json({ salesOrder: updatedSO, handoverDoc: handover })
  } catch (e) { res.status(500).json({ error: 'Failed to mark as won' }) }
})

router.delete('/:id', requirePermission('sales_order', 'delete'), async (req, res) => {
  try {
    const linked = await prisma.project.findFirst({ where: { salesOrderId: (req.params.id as string) } })
    if (linked) return res.status(400).json({ error: 'Cannot delete — a project has already been created from this sales order' })
    await prisma.salesOrder.delete({ where: { id: (req.params.id as string) } })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: 'Failed to delete sales order' }) }
})

export default router
