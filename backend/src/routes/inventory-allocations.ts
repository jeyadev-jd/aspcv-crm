import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'

const router = createSafeRouter()
router.use(authenticate)

router.get('/', requirePermission('inventory_allocation', 'read_all'), async (req, res) => {
  try {
    const { projectId, rawComponentId, includeReversed } = req.query
    const pagination = parsePagination(req.query as Record<string, unknown>, 'allocatedAt')
    const where = {
      ...(projectId ? { projectId: String(projectId) } : {}),
      ...(rawComponentId ? { rawComponentId: String(rawComponentId) } : {}),
      // Returned allocations stay on record but are not live stock on the project.
      ...(includeReversed === 'true' ? {} : { reversedAt: null }),
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

      // Stock value moves out of the central warehouse and onto the project's books.
      const rc = await tx.rawComponent.findUnique({ where: { id: rawComponentId }, select: { price: true } })
      const movedValue = (rc?.price || 0) * quantity
      if (movedValue > 0) {
        await tx.project.update({
          where: { id: projectId },
          data: { inventoryCost: { increment: movedValue } },
        })
      }
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

// FIFO auto-allocation: picks oldest in_stock component matching itemName
router.post('/fifo-allocate', requirePermission('inventory_allocation', 'create'), async (req: AuthRequest, res) => {
  const { itemName, projectId, quantity, notes } = req.body as { itemName: string; projectId: string; quantity: number; notes?: string }
  if (!itemName || !projectId || !quantity || quantity <= 0) {
    res.status(400).json({ error: 'itemName, projectId, and positive quantity required' })
    return
  }

  // Find oldest in_stock components matching name (FIFO: lowest receivedAt first)
  const candidates = await prisma.rawComponent.findMany({
    where: {
      status: 'in_stock',
      name: { contains: itemName, mode: 'insensitive' },
    },
    orderBy: { receivedAt: 'asc' },
  })

  const totalAvailable = candidates.reduce((s, c) => s + (c.quantity || 1), 0)
  if (totalAvailable < quantity) {
    res.status(400).json({ error: `Insufficient FIFO stock: need ${quantity}, available ${totalAvailable}` })
    return
  }

  const allocations: string[] = []
  let remaining = quantity
  let movedValue = 0

  await prisma.$transaction(async tx => {
    for (const rc of candidates) {
      if (remaining <= 0) break
      const take = Math.min(remaining, rc.quantity || 1)
      const newQty = (rc.quantity || 1) - take

      await tx.rawComponent.update({
        where: { id: rc.id },
        data: {
          quantity: newQty,
          status: newQty === 0 ? 'assigned' : 'in_stock',
          assignedToType: newQty === 0 ? 'project' : rc.assignedToType,
          assignedToId: newQty === 0 ? projectId : rc.assignedToId,
          assignedAt: newQty === 0 ? new Date() : rc.assignedAt,
        },
      })

      const alloc = await tx.inventoryAllocation.create({
        data: { rawComponentId: rc.id, projectId, quantity: take, allocatedById: req.user?.id, notes },
      })
      allocations.push(alloc.id)

      await tx.componentMovement.create({
        data: {
          componentId: rc.id,
          type: 'assigned',
          toEntityType: 'project',
          toEntityId: projectId,
          performedById: req.user?.id,
          notes: `FIFO allocation (received ${rc.receivedAt.toISOString().slice(0, 10)})`,
        },
      })
      remaining -= take
      movedValue += (rc.price || 0) * take
    }

    if (movedValue > 0) {
      await tx.project.update({ where: { id: projectId }, data: { inventoryCost: { increment: movedValue } } })
    }
  })

  res.status(201).json({ allocated: quantity, allocationIds: allocations, inventoryCostAdded: movedValue })
})

// Return allocation back to raw materials
router.delete('/:id', requirePermission('inventory_allocation', 'delete'), async (req: AuthRequest, res) => {
  try {
    await prisma.$transaction(async tx => {
      const alloc = await tx.inventoryAllocation.findUniqueOrThrow({ where: { id: (req.params.id as string) } })
      if (alloc.reversedAt) throw new Error('ALREADY_REVERSED')
      // Marked reversed, not deleted — the row is the audit trail for this movement.
      await tx.inventoryAllocation.update({
        where: { id: alloc.id },
        data: { reversedAt: new Date(), reversedById: req.user?.id },
      })
      const rc = await tx.rawComponent.update({
        where: { id: alloc.rawComponentId },
        data: { quantity: { increment: alloc.quantity } },
      })
      // Value goes back to the warehouse, so take it off the project's inventory cost.
      const returnedValue = (rc.price || 0) * alloc.quantity
      if (returnedValue > 0) {
        await tx.project.update({
          where: { id: alloc.projectId },
          data: { inventoryCost: { decrement: returnedValue } },
        })
      }
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
  } catch (e: any) {
    if (e?.message === 'ALREADY_REVERSED') return res.status(400).json({ error: 'Allocation already returned' })
    res.status(500).json({ error: 'Failed to return allocation' })
  }
})

export default router
