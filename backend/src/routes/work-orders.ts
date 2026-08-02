import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { appendEvent } from '../services/timeline'
import { parsePagination, paginate } from '../lib/pagination'
import { nextWONumber } from '../lib/sequences'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const workOrderSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  notes: z.string().optional(),
  scopeItemId: z.string().optional(),
})

const workOrderUpdateSchema = z.object({
  title: z.string().optional(),
  status: z.string().optional(),
  labourCost: z.number().optional(),
  notes: z.string().optional(),
  scopeItemId: z.string().nullable().optional(),
})

router.get('/', requirePermission('work_order', 'read_all'), async (req, res) => {
  try {
    const { projectId } = req.query
    const pagination = parsePagination(req.query as Record<string, unknown>, 'createdAt')
    const where = projectId ? { projectId: String(projectId) } : {}
    const [wos, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        include: {
          project: { select: { id: true, title: true } },
          scopeItem: { select: { id: true, title: true, productType: true } },
          logs: { orderBy: { createdAt: 'desc' }, take: 5 },
          materialConsumptions: { include: { rawComponent: { select: { id: true, name: true, unit: true } } } },
        },
        orderBy: { [pagination.sort as string]: pagination.order },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.workOrder.count({ where }),
    ])
    res.json(paginate(wos, total, pagination))
  } catch (e) { res.status(500).json({ error: 'Failed to fetch work orders' }) }
})

router.get('/:id', requirePermission('work_order', 'read_all'), async (req, res) => {
  try {
    const wo = await prisma.workOrder.findUnique({
      where: { id: (req.params.id as string) },
      include: {
        project: true,
        scopeItem: true,
        logs: { orderBy: { createdAt: 'asc' } },
        materialConsumptions: { include: { rawComponent: true } },
      },
    })
    if (!wo) return res.status(404).json({ error: 'Not found' })
    res.json(wo)
  } catch (e) { res.status(500).json({ error: 'Failed to fetch work order' }) }
})

router.post('/', requirePermission('work_order', 'create'), async (req: AuthRequest, res) => {
  try {
    const data = workOrderSchema.parse(req.body)
    const refNumber = await nextWONumber()
    const [wo] = await prisma.$transaction([
      prisma.workOrder.create({
        data: { refNumber, projectId: data.projectId, title: data.title, notes: data.notes, scopeItemId: data.scopeItemId, createdById: req.user?.id },
        include: { logs: true, scopeItem: true },
      }),
      prisma.project.update({ where: { id: data.projectId }, data: { status: 'Manufacturing' } }),
    ])
    await appendEvent('WorkOrder', wo.id, 'CREATED', `Work order "${wo.title}" created`, req.user?.id)
    res.status(201).json(wo)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to create work order' }) }
})

router.put('/:id', requirePermission('work_order', 'edit'), async (req: AuthRequest, res) => {
  try {
    const data = workOrderUpdateSchema.parse(req.body)
    const wo = await prisma.$transaction(async tx => {
      const existing = await tx.workOrder.findUniqueOrThrow({ where: { id: (req.params.id as string) } })
      const updateData: any = { title: data.title, notes: data.notes }
      if (data.scopeItemId !== undefined) updateData.scopeItemId = data.scopeItemId
      if (data.status) updateData.status = data.status
      if (data.status === 'InProduction' && !existing.startedAt) updateData.startedAt = new Date()
      if (data.status === 'Finished') {
        updateData.finishedAt = new Date()
        // Mark all consumed raw components as fully consumed
        const consumptions = await tx.materialConsumption.findMany({
          where: { workOrderId: req.params.id as string },
          select: { rawComponentId: true },
        })
        const rcIds = [...new Set(consumptions.map(c => c.rawComponentId))]
        if (rcIds.length > 0) {
          await tx.rawComponent.updateMany({
            where: { id: { in: rcIds }, status: 'assigned' },
            data: { status: 'consumed' },
          })
        }
        // Advance project to Installation if ALL work orders for it are now Finished
        const openWOs = await tx.workOrder.count({
          where: {
            projectId: existing.projectId,
            id: { not: req.params.id as string },
            status: { notIn: ['Finished', 'Cancelled'] },
          },
        })
        if (openWOs === 0) {
          await tx.project.update({
            where: { id: existing.projectId },
            data: { status: 'Installation' },
          })
        }
      }

      if (data.labourCost !== undefined) {
        updateData.labourCost = data.labourCost
        updateData.totalCost = existing.materialCost + data.labourCost
        const project = await tx.project.findUnique({ where: { id: existing.projectId } })
        if (project) {
          const delta = data.labourCost - (existing.labourCost || 0)
          const newLabourCost = (project.labourCost || 0) + delta
          const newTotalExpenses = (project.totalExpenses || 0) + delta
          await tx.project.update({
            where: { id: existing.projectId },
            data: {
              labourCost: newLabourCost,
              totalExpenses: newTotalExpenses,
              profit: (project.budget || 0) - newTotalExpenses,
            },
          })
        }
      }
      return tx.workOrder.update({ where: { id: (req.params.id as string) }, data: updateData })
    })
    if (data.status) await appendEvent('WorkOrder', wo.id, 'STATUS_CHANGED', `Status changed to ${data.status}`, req.user?.id)
    res.json(wo)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to update work order' }) }
})

// Add production log entry
router.post('/:id/logs', requirePermission('work_order', 'edit'), async (req: AuthRequest, res) => {
  try {
    const { entry } = req.body
    if (!entry?.trim()) return res.status(400).json({ error: 'entry required' })
    const actor = req.user?.id ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } }) : null
    const log = await prisma.productionLog.create({
      data: {
        workOrderId: (req.params.id as string),
        entry,
        actorId: req.user?.id,
        actorName: actor?.name,
      },
    })
    res.status(201).json(log)
  } catch (e) { res.status(500).json({ error: 'Failed to add log' }) }
})

// Consume material from allocated inventory
router.post('/:id/consume', requirePermission('work_order', 'edit'), async (req: AuthRequest, res) => {
  try {
    const { rawComponentId, quantity, notes } = req.body as { rawComponentId: string; quantity: number; notes?: string }
    if (!rawComponentId || !quantity || quantity <= 0) return res.status(400).json({ error: 'rawComponentId and positive quantity required' })
    const userId = req.user?.id

    const result = await prisma.$transaction(async tx => {
      const wo = await tx.workOrder.findUniqueOrThrow({ where: { id: (req.params.id as string) } })
      const rc = await tx.rawComponent.findUniqueOrThrow({ where: { id: rawComponentId } })
      if ((rc.quantity || 0) < quantity) throw new Error('INSUFFICIENT_STOCK')

      const unitCost = rc.price || 0
      const totalCost = unitCost * quantity

      await tx.materialConsumption.create({
        data: { workOrderId: (req.params.id as string), rawComponentId, quantity, unitCost, totalCost, consumedById: userId, notes },
      })
      await tx.rawComponent.update({
        where: { id: rawComponentId },
        data: { quantity: { decrement: quantity } },
      })
      const allocation = await tx.inventoryAllocation.findFirst({
        where: { rawComponentId, projectId: wo.projectId },
      })
      if (allocation) {
        await tx.inventoryAllocation.update({
          where: { id: allocation.id },
          data: { quantity: { decrement: Math.min(quantity, allocation.quantity) } },
        })
      }
      await tx.workOrder.update({
        where: { id: (req.params.id as string) },
        data: {
          materialCost: wo.materialCost + totalCost,
          totalCost: wo.totalCost + totalCost,
        },
      })
      await tx.componentMovement.create({
        data: {
          componentId: rawComponentId, type: 'assigned',
          toEntityType: 'work_order', toEntityId: (req.params.id as string),
          performedById: userId, notes: `Consumed in ${wo.refNumber}`,
        },
      })

      const project = await tx.project.findUnique({ where: { id: wo.projectId } })
      if (project) {
        const newTotalExpenses = (project.totalExpenses || 0) + totalCost
        await tx.project.update({
          where: { id: wo.projectId },
          data: {
            manufacturingCost: (project.manufacturingCost || 0) + totalCost,
            remainingBudget: Math.max(0, (project.remainingBudget || 0) - totalCost),
            totalExpenses: newTotalExpenses,
            profit: (project.budget || 0) - newTotalExpenses,
          },
        })
      }

      return { totalCost, refNumber: wo.refNumber }
    })

    await appendEvent('WorkOrder', req.params.id as string, 'MATERIAL_CONSUMED',
      `Consumed ${quantity} unit(s), cost ₹${result.totalCost.toLocaleString()}`, userId)
    res.status(201).json({ ok: true, totalCost: result.totalCost })
  } catch (e: any) {
    if (e?.message === 'INSUFFICIENT_STOCK') return res.status(400).json({ error: 'Insufficient stock' })
    res.status(500).json({ error: 'Failed to consume material' })
  }
})

router.delete('/:id', requirePermission('work_order', 'delete'), async (req, res) => {
  try {
    await prisma.workOrder.delete({ where: { id: (req.params.id as string) } })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: 'Failed to delete work order' }) }
})

router.post('/bulk-delete', requirePermission('work_order', 'delete'), async (req, res) => {
  try {
    const { ids } = req.body as { ids?: string[] }
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' })
    const result = await prisma.workOrder.deleteMany({ where: { id: { in: ids } } })
    res.json({ deleted: result.count })
  } catch (e) { res.status(500).json({ error: 'Failed to delete work orders' }) }
})

export default router
