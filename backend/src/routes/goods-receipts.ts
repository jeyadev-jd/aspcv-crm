import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { appendEvent } from '../services/timeline'
import { nextGRNumber } from '../lib/sequences'
import { createNotification, notifyRoles } from '../services/notify'
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

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
      include: { project: true, items: true },
    })
    if (!po) return res.status(404).json({ error: 'Purchase order not found' })
    const linkedProjectId = po.projectId ?? null

    // ─── 3-way PO match: validate GRN quantities against PO line items ──────
    if (po.items.length > 0) {
      for (const grItem of data.items) {
        const poLine = po.items.find(
          p => p.itemName.trim().toLowerCase() === grItem.itemName.trim().toLowerCase()
        )
        if (poLine) {
          const incoming = grItem.quantity || 1
          const alreadyReceived = poLine.receivedQty || 0
          const ordered = poLine.quantity
          if (alreadyReceived + incoming > ordered) {
            return res.status(400).json({
              error: `Over-receipt: "${grItem.itemName}" — PO ordered ${ordered}, already received ${alreadyReceived}, trying to receive ${incoming}. Max allowed: ${ordered - alreadyReceived}.`,
              itemName: grItem.itemName,
              ordered,
              alreadyReceived,
              incoming,
            })
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const refNumber = await nextGRNumber()
    const totalCost = data.items.reduce((s, i) => s + ((i.unitPrice || 0) * (i.quantity || 1)), 0)

    const gr = await prisma.$transaction(async tx => {
      const rawComponentIds: string[] = []
      for (const item of data.items) {
        const rc = await tx.rawComponent.create({
          data: {
            refNumber: `RC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

      // Update receivedQty on matched PO line items
      for (const grItem of data.items) {
        const poLine = po.items.find(
          p => p.itemName.trim().toLowerCase() === grItem.itemName.trim().toLowerCase()
        )
        if (poLine) {
          await tx.pOItem.update({
            where: { id: poLine.id },
            data: { receivedQty: { increment: grItem.quantity || 1 } },
          })
        }
      }

      // Check if all PO lines are fully received
      const updatedPoItems = await tx.pOItem.findMany({ where: { purchaseOrderId: data.purchaseOrderId } })
      const allReceived = updatedPoItems.every(i => i.receivedQty >= i.quantity)
      await tx.purchaseOrder.update({
        where: { id: data.purchaseOrderId },
        data: { status: allReceived ? 'Closed' : 'Delivered', deliveredAt: new Date() },
      })

      if (linkedProjectId) {
        const project = await tx.project.findUnique({ where: { id: linkedProjectId } })
        if (project) {
          const newPurchaseCost = (project.purchaseCost || 0) + totalCost
          const newTotalExpenses = (project.manufacturingCost || 0) + newPurchaseCost + (project.serviceCost || 0) + (project.labourCost || 0) + (project.installationCost || 0)
          await tx.project.update({
            where: { id: linkedProjectId },
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
    if (linkedProjectId) {
      await appendEvent('Project', linkedProjectId, 'GOODS_RECEIVED', `Goods receipt "${gr.refNumber}" recorded, inventory cost updated`, req.user?.id)

      // Stock lands in the central warehouse, never straight onto the project — ping
      // whoever owns the project so they come and allocate it.
      const owner = await prisma.project.findUnique({
        where: { id: linkedProjectId },
        select: { title: true, assignedPMId: true, department: { select: { headUserId: true } } },
      })
      const recipients = [owner?.assignedPMId, owner?.department?.headUserId].filter(Boolean) as string[]
      const payload = {
        type: 'goods_arrived',
        severity: 'info' as const,
        title: 'Goods arrived in Warehouse',
        message: `Goods receipt ${gr.refNumber} for "${owner?.title ?? 'project'}" is in the Central Warehouse. Please allocate to your project.`,
        entityType: 'Project',
        entityId: linkedProjectId,
      }
      if (recipients.length > 0) await createNotification({ userIds: [...new Set(recipients)], ...payload })
      else await notifyRoles(['ProjectHead', 'SuperAdmin'], payload)
    }
    res.status(201).json(gr)
  } catch (e: any) {
    console.error(e)
    res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to create goods receipt' })
  }
})

export default router
