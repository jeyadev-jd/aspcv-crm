import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'

const router = createSafeRouter()
router.use(authenticate)

router.get('/', requirePermission('inventory_allocation', 'read_all'), async (req, res) => {
  try {
    const { projectId, rawComponentId } = req.query
    const pagination = parsePagination(req.query as Record<string, unknown>, 'allocatedAt')
    const where = {
      ...(projectId ? { projectId: String(projectId) } : {}),
      ...(rawComponentId ? { rawComponentId: String(rawComponentId) } : {}),
    }
    const [allocs, total] = await Promise.all([
      prisma.inventoryAllocation.findMany({
        where,
        include: {
          rawComponent: true,
          project: { select: { id: true, title: true } },
        },
        orderBy: { [pagination.sort as string]: pagination.order },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.inventoryAllocation.count({ where }),
    ])
    res.json(paginate(allocs, total, pagination))
  } catch (e) { res.status(500).json({ error: 'Failed to fetch allocations' }) }
})

// Inventory Manager manually allocates raw material to project
router.post('/', requirePermission('inventory_allocation', 'create'), async (req: AuthRequest, res) => {
  try {
    const { rawComponentId, projectId, quantity, notes } = req.body as { rawComponentId: string; projectId: string; quantity: number; notes?: string }
    if (!rawComponentId || !projectId || !quantity || quantity <= 0) return res.status(400).json({ error: 'rawComponentId, projectId, and positive quantity required' })
    const userId = req.user?.id

    const alloc = await prisma.$transaction(async tx => {
      // Atomic conditional decrement — only succeeds if quantity >= requested, eliminating the check-then-act race
      const result = await tx.rawComponent.updateMany({
        where: { id: rawComponentId, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      })
      if (result.count === 0) throw new Error('INSUFFICIENT_STOCK')

      const created = await tx.inventoryAllocation.create({
        data: { rawComponentId, projectId, quantity, allocatedById: userId, notes },
      })
      await tx.componentMovement.create({
        data: {
          componentId: rawComponentId,
          type: 'assigned',
          toEntityType: 'project',
          toEntityId: projectId,
          performedById: userId,
          notes: notes || `Allocated to project`,
        },
      })
      return created
    })

    res.status(201).json(alloc)
  } catch (e: any) {
    if (e?.message === 'INSUFFICIENT_STOCK') return res.status(400).json({ error: 'Insufficient stock' })
    res.status(500).json({ error: 'Failed to allocate material' })
  }
})

// Return allocation back to raw materials
router.delete('/:id', requirePermission('inventory_allocation', 'delete'), async (req: AuthRequest, res) => {
  try {
    await prisma.$transaction(async tx => {
      const alloc = await tx.inventoryAllocation.findUniqueOrThrow({ where: { id: (req.params.id as string) } })
      await tx.inventoryAllocation.delete({ where: { id: (req.params.id as string) } })
      await tx.rawComponent.update({
        where: { id: alloc.rawComponentId },
        data: { quantity: { increment: alloc.quantity } },
      })
      await tx.componentMovement.create({
        data: {
          componentId: alloc.rawComponentId,
          type: 'returned',
          toEntityType: 'inventory',
          toEntityId: 'raw_materials',
          toEntityName: 'Raw Materials',
          performedById: req.user?.id,
          notes: 'Returned from project allocation',
        },
      })
    })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: 'Failed to return allocation' }) }
})

export default router
