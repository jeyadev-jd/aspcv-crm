import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { appendEvent } from '../services/timeline'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const grItemSchema = z.object({
  itemName: z.string().min(1),
  description: z.string().nullish(),
  quantity: z.number().optional(),
  unit: z.string().nullish(),
  unitPrice: z.number().nullish(),
})

const grSchema = z.object({
  purchaseOrderId: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(grItemSchema).min(1),
})

router.get('/', requirePermission('goods_receipt', 'read_all'), async (req, res) => {
  try {
    const { purchaseOrderId } = req.query
    const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
    const where = purchaseOrderId ? { purchaseOrderId: String(purchaseOrderId) } : {}
    const [grs, total] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where,
        include: {
          purchaseOrder: { select: { id: true, refNumber: true, supplierName: true } },
          items: true,
        },
        orderBy: { [pagination.sort as string]: pagination.order },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.goodsReceipt.count({ where }),
    ])
    res.json(paginate(grs, total, pagination))
  } catch (e) { res.status(500).json({ error: 'Failed to fetch goods receipts' }) }
})

router.get('/:id', requirePermission('goods_receipt', 'read_all'), async (req, res) => {
  try {
    const gr = await prisma.goodsReceipt.findUnique({
      where: { id: (req.params.id as string) },
      include: { purchaseOrder: { include: { items: true } }, items: true },
    })
    if (!gr) return res.status(404).json({ error: 'Not found' })
    res.json(gr)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch goods receipt' }) }
})

// Receive goods: creates GR + RawComponent entries in inventory (never auto-assigns to project)
router.post('/', requirePermission('goods_receipt', 'create'), async (req: AuthRequest, res) => {
  try {
    const data = grSchema.parse(req.body)
    const userId = req.user?.id

    const po = await prisma.purchaseOrder.findUnique({ where: { id: data.purchaseOrderId }, include: { bom: { include: { project: true } } } })
    if (!po) return res.status(404).json({ error: 'Purchase order not found' })

    const count = await prisma.goodsReceipt.count()
    const refNumber = `GR-${String(count + 1).padStart(4, '0')}`
    const totalCost = data.items.reduce((s, i) => s + ((i.unitPrice || 0) * (i.quantity || 1)), 0)

    const gr = await prisma.$transaction(async tx => {
      const rawComponentIds: string[] = []
      for (const item of data.items) {
        const rcCount = await tx.rawComponent.count()
        const rc = await tx.rawComponent.create({
          data: {
            refNumber: `RC-${String(rcCount + 1).padStart(5, '0')}`,
            name: item.itemName,
            category: 'Raw', // ALWAYS raw materials first
            quantity: item.quantity || 1,
            unit: item.unit,
            price: item.unitPrice,
            status: 'in_stock',
            dealerName: po.supplierName,
            notes: item.description,
          },
        })
        rawComponentIds.push(rc.id)

        await tx.componentMovement.create({
          data: {
            componentId: rc.id,
            type: 'received',
            toEntityType: 'goods_receipt',
            toEntityId: refNumber,
            toEntityName: 'Raw Materials Inventory',
            performedById: userId,
            notes: `Received via PO ${po.refNumber}`,
          },
        })
      }

      const created = await tx.goodsReceipt.create({
        data: {
          refNumber, purchaseOrderId: data.purchaseOrderId, receivedById: userId, notes: data.notes,
          items: {
            create: data.items.map((item, idx) => ({
              itemName: item.itemName,
              description: item.description,
              quantity: item.quantity || 1,
              unit: item.unit,
              unitPrice: item.unitPrice || 0,
              rawComponentId: rawComponentIds[idx],
            })),
          },
        },
        include: { items: true },
      })

      await tx.purchaseOrder.update({
        where: { id: data.purchaseOrderId },
        data: { status: 'Delivered', deliveredAt: new Date() },
      })

      if (po.bom?.projectId) {
        const project = await tx.project.findUnique({ where: { id: po.bom.projectId } })
        if (project) {
          const newPurchaseCost = (project.purchaseCost || 0) + totalCost
          const newTotalExpenses = (project.manufacturingCost || 0) + newPurchaseCost + (project.serviceCost || 0) + (project.labourCost || 0) + (project.installationCost || 0)
          await tx.project.update({
            where: { id: po.bom.projectId },
            data: {
              purchaseCost: newPurchaseCost,
              totalExpenses: newTotalExpenses,
              profit: (project.budget || 0) - newTotalExpenses,
            },
          })
        }
      }

      return created
    })

    await appendEvent('GoodsReceipt', gr.id, 'CREATED', `Goods receipt "${gr.refNumber}" recorded against PO ${po.refNumber}`, req.user?.id)
    if (po.bom?.projectId) {
      await appendEvent('Project', po.bom.projectId, 'GOODS_RECEIVED', `Goods receipt "${gr.refNumber}" recorded, inventory cost updated`, req.user?.id)
    }
    res.status(201).json(gr)
  } catch (e: any) {
    console.error(e)
    res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to create goods receipt' })
  }
})

export default router
