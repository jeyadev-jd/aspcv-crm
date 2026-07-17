import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { appendEvent } from '../services/timeline'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const DEFAULT_TAX_PERCENT = 18

const poItemSchema = z.object({
  itemName: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  unitPrice: z.number().optional(),
  amount: z.number().optional(),
})

const poSchema = z.object({
  bomId: z.string().optional(),
  supplierName: z.string().min(1),
  supplierEmail: z.string().optional(),
  supplierPhone: z.string().optional(),
  supplierAddress: z.string().optional(),
  expectedDelivery: z.string().optional(),
  taxPercent: z.number().optional(),
  notes: z.string().optional(),
  items: z.array(poItemSchema).optional(),
})

function computeTotals(items: z.infer<typeof poItemSchema>[], taxPercent: number) {
  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0)
  const totalAmount = subtotal * (1 + taxPercent / 100)
  return { subtotal, totalAmount }
}

router.get('/', requirePermission('purchase_order', 'read_all'), async (req, res) => {
  try {
    const { bomId } = req.query
    const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
    const where = bomId ? { bomId: String(bomId) } : {}
    const [pos, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          bom: { include: { project: { select: { id: true, title: true } } } },
          items: true,
          goodsReceipts: { select: { id: true, refNumber: true, receivedAt: true } },
        },
        orderBy: { [pagination.sort as string]: pagination.order },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.purchaseOrder.count({ where }),
    ])
    res.json(paginate(pos, total, pagination))
  } catch (e) { res.status(500).json({ error: 'Failed to fetch purchase orders' }) }
})

router.get('/:id', requirePermission('purchase_order', 'read_all'), async (req, res) => {
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: (req.params.id as string) },
      include: { bom: { include: { project: true } }, items: true, goodsReceipts: { include: { items: true } } },
    })
    if (!po) return res.status(404).json({ error: 'Not found' })
    res.json(po)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch purchase order' }) }
})

router.post('/', requirePermission('purchase_order', 'create'), async (req: AuthRequest, res) => {
  try {
    const data = poSchema.parse(req.body)
    const items = data.items || []
    const taxPercent = data.taxPercent ?? DEFAULT_TAX_PERCENT
    const { subtotal, totalAmount } = computeTotals(items, taxPercent)
    const count = await prisma.purchaseOrder.count()
    const refNumber = `PO-${String(count + 1).padStart(4, '0')}`
    const po = await prisma.purchaseOrder.create({
      data: {
        refNumber, bomId: data.bomId, supplierName: data.supplierName, supplierEmail: data.supplierEmail,
        supplierPhone: data.supplierPhone, supplierAddress: data.supplierAddress,
        expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : undefined,
        taxPercent, subtotal, totalAmount, notes: data.notes,
        createdById: req.user?.id,
        items: {
          create: items.map(i => ({
            itemName: i.itemName, description: i.description,
            quantity: i.quantity || 1, unit: i.unit,
            unitPrice: i.unitPrice || 0, amount: i.amount || 0,
          })),
        },
      },
      include: { items: true },
    })
    await appendEvent('PurchaseOrder', po.id, 'CREATED', `Purchase order "${po.refNumber}" created`, req.user?.id)
    res.status(201).json(po)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to create purchase order' }) }
})

router.put('/:id', requirePermission('purchase_order', 'edit'), async (req: AuthRequest, res) => {
  try {
    const data = poSchema.partial().parse(req.body)
    const po = await prisma.$transaction(async tx => {
      let totals: { subtotal?: number; totalAmount?: number } = {}
      if (data.items) {
        await tx.pOItem.deleteMany({ where: { purchaseOrderId: (req.params.id as string) } })
        await tx.pOItem.createMany({
          data: data.items.map(i => ({
            purchaseOrderId: (req.params.id as string),
            itemName: i.itemName, description: i.description,
            quantity: i.quantity || 1, unit: i.unit,
            unitPrice: i.unitPrice || 0, amount: i.amount || 0,
          })),
        })
        const existing = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: (req.params.id as string) } })
        const taxPercent = data.taxPercent ?? existing.taxPercent
        totals = computeTotals(data.items, taxPercent)
      }
      return tx.purchaseOrder.update({
        where: { id: (req.params.id as string) },
        data: {
          supplierName: data.supplierName, supplierEmail: data.supplierEmail, supplierPhone: data.supplierPhone,
          supplierAddress: data.supplierAddress,
          expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : undefined,
          taxPercent: data.taxPercent, notes: data.notes,
          ...totals,
        },
        include: { items: true },
      })
    })
    await appendEvent('PurchaseOrder', po.id, 'UPDATED', `Purchase order "${po.refNumber}" updated`, req.user?.id)
    res.json(po)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to update purchase order' }) }
})

router.post('/:id/approve', requirePermission('purchase_order', 'approve'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.purchaseOrder.findUnique({ where: { id: (req.params.id as string) } })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    if (existing.status !== 'Draft') return res.status(400).json({ error: `Cannot approve a PO in ${existing.status} status` })
    const po = await prisma.purchaseOrder.update({
      where: { id: (req.params.id as string) },
      data: { status: 'Approved', approvedById: req.user?.id, approvedAt: new Date() },
    })
    await appendEvent('PurchaseOrder', po.id, 'APPROVED', `Purchase order "${po.refNumber}" approved`, req.user?.id)
    res.json(po)
  } catch (e) { res.status(500).json({ error: 'Failed to approve PO' }) }
})

router.post('/:id/send', requirePermission('purchase_order', 'approve'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.purchaseOrder.findUnique({ where: { id: (req.params.id as string) } })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    if (existing.status !== 'Approved') return res.status(400).json({ error: `Cannot send a PO in ${existing.status} status — must be Approved first` })
    const po = await prisma.purchaseOrder.update({ where: { id: (req.params.id as string) }, data: { status: 'Sent' } })
    await appendEvent('PurchaseOrder', po.id, 'SENT', `Purchase order "${po.refNumber}" sent to supplier`, req.user?.id)
    res.json(po)
  } catch (e) { res.status(500).json({ error: 'Failed to send PO' }) }
})

router.delete('/:id', requirePermission('purchase_order', 'delete'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id as string } })
    await prisma.purchaseOrder.delete({ where: { id: (req.params.id as string) } })
    if (existing) await appendEvent('PurchaseOrder', existing.id, 'DELETED', `Purchase order "${existing.refNumber}" deleted`, req.user?.id)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: 'Failed to delete PO — it may have linked goods receipts' }) }
})

export default router
