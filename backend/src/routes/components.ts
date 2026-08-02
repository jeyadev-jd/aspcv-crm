import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'

const router = createSafeRouter()
router.use(authenticate)

async function nextRefNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.rawComponent.count({ where: { refNumber: { startsWith: `RC-${year}-` } } })
  return `RC-${year}-${String(count + 1).padStart(4, '0')}`
}

router.get('/', async (req, res) => {
  const { status, category, oldestFirst, all } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'receivedAt')
  const where = {
    ...(status && { status }),
    ...(category && {
      // 'Raw' also matches uncategorized components — most were created before
      // categorization existed and would otherwise be invisible to every filter.
      OR: category === 'Raw' ? [{ category: 'Raw' }, { category: null }] : [{ category }],
    }),
    ...(pagination.search && { name: { contains: pagination.search, mode: 'insensitive' as const } }),
  }
  const sortField = req.query.sort ? pagination.sort as string : 'receivedAt'
  const sortOrder = req.query.sort ? pagination.order : (oldestFirst === 'false' ? 'desc' : 'asc')
  // Inventory pickers (e.g. the scope-line assign modal) need the *entire*
  // matching set to search/select from, not one capped page — the shared
  // MAX_PAGE_SIZE exists to protect big paginated lists, not this use case,
  // and total inventory here stays small enough that fetching it all is cheap.
  const [components, total] = await Promise.all([
    prisma.rawComponent.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      ...(all === 'true' ? {} : { skip: pagination.skip, take: pagination.take }),
    }),
    prisma.rawComponent.count({ where }),
  ])
  res.json(paginate(components, total, pagination))
})

router.get('/:id', async (req, res) => {
  const component = await prisma.rawComponent.findUnique({
    where: { id: req.params.id as string },
    include: { movements: { orderBy: { createdAt: 'desc' } } },
  })
  if (!component) { res.status(404).json({ error: 'Not found' }); return }
  res.json(component)
})

router.post('/', requirePermission('component', 'create'), async (req: AuthRequest, res) => {
  const { name, category, warrantyMonths, receivedAt, customFields, notes,
          dealerId, dealerName, price, gstPercent, hsnCode, unit, quantity } = req.body
  if (!name?.trim()) { res.status(400).json({ error: 'Name required' }); return }

  const refNumber = await nextRefNumber()
  const component = await prisma.rawComponent.create({
    data: {
      refNumber,
      name,
      category: category ?? null,
      warrantyMonths: warrantyMonths ?? null,
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      customFields: customFields ?? null,
      notes: notes ?? null,
      dealerId: dealerId ?? null,
      dealerName: dealerName ?? null,
      price: price ?? null,
      gstPercent: gstPercent ?? null,
      hsnCode: hsnCode ?? null,
      unit: unit ?? null,
      quantity: quantity ?? 1,
    },
  })

  await prisma.componentMovement.create({
    data: { componentId: component.id, type: 'received', performedById: req.user!.id, notes: 'Initial stock' },
  })

  res.status(201).json(component)
})

router.patch('/:id', requirePermission('component', 'edit'), async (req: AuthRequest, res) => {
  const { name, category, warrantyMonths, customFields, notes,
          dealerId, dealerName, price, gstPercent, hsnCode, unit, quantity } = req.body
  const component = await prisma.rawComponent.update({
    where: { id: req.params.id as string },
    data: {
      ...(name && { name }),
      ...(category !== undefined && { category }),
      ...(warrantyMonths !== undefined && { warrantyMonths }),
      ...(customFields !== undefined && { customFields }),
      ...(notes !== undefined && { notes }),
      ...(dealerId !== undefined && { dealerId }),
      ...(dealerName !== undefined && { dealerName }),
      ...(price !== undefined && { price }),
      ...(gstPercent !== undefined && { gstPercent }),
      ...(hsnCode !== undefined && { hsnCode }),
      ...(unit !== undefined && { unit }),
      ...(quantity !== undefined && { quantity }),
    },
  })
  res.json(component)
})

// Assign to project/installation/lead
router.post('/:id/assign', requirePermission('component', 'assign'), async (req: AuthRequest, res) => {
  const { toEntityType, toEntityId, toEntityName, notes } = req.body

  const { count } = await prisma.rawComponent.updateMany({
    where: { id: req.params.id as string, status: 'in_stock' },
    data: { status: 'assigned', assignedToType: toEntityType, assignedToId: toEntityId, assignedAt: new Date() },
  })
  if (count === 0) {
    const existing = await prisma.rawComponent.findUnique({ where: { id: req.params.id as string } })
    res.status(existing ? 400 : 404).json({ error: existing ? 'Component is not available to assign' : 'Not found' })
    return
  }

  const component = await prisma.rawComponent.findUniqueOrThrow({ where: { id: req.params.id as string } })

  await prisma.componentMovement.create({
    data: { componentId: component.id, type: 'assigned', toEntityType, toEntityId, toEntityName: toEntityName ?? null, performedById: req.user!.id, notes: notes ?? null },
  })

  res.json(component)
})

// Return to stock
router.post('/:id/return', async (req: AuthRequest, res) => {
  const { notes } = req.body
  const component = await prisma.rawComponent.update({
    where: { id: req.params.id as string },
    data: { status: 'in_stock', assignedToType: null, assignedToId: null, assignedAt: null },
  })
  await prisma.componentMovement.create({
    data: { componentId: component.id, type: 'returned', performedById: req.user!.id, notes: notes ?? null },
  })
  res.json(component)
})

router.get('/:id/movements', async (req, res) => {
  const movements = await prisma.componentMovement.findMany({
    where: { componentId: req.params.id as string },
    orderBy: { createdAt: 'desc' },
  })
  res.json(movements)
})

/**
 * A component may only be removed while it is still unattached stock. Once it
 * has been allocated to a project, consumed, pushed to inventory or named on a
 * scope item, the row is referenced by records that must keep their history, so
 * deleting it would either fail on the foreign key or silently orphan them.
 *
 * Returns null when deletable, otherwise the reason to report to the caller.
 */
async function blockedReason(id: string): Promise<string | null> {
  const component = await prisma.rawComponent.findUnique({
    where: { id },
    select: {
      status: true,
      assignedToId: true,
      _count: {
        select: {
          inventoryAllocations: true, materialConsumptions: true,
          scopeItems: true, inventoryPushes: true,
        },
      },
    },
  })
  if (!component) return 'Not found'
  if (component.assignedToId || component.status !== 'in_stock') return 'Assigned — return it to stock first'
  if (component._count.inventoryAllocations > 0) return 'Allocated to a project'
  if (component._count.materialConsumptions > 0) return 'Consumed by a work order'
  if (component._count.scopeItems > 0) return 'Referenced by a scope item'
  if (component._count.inventoryPushes > 0) return 'Pushed to a project'
  return null
}

router.delete('/:id', requirePermission('component', 'delete'), async (req: AuthRequest, res) => {
  const id = req.params.id as string
  const reason = await blockedReason(id)
  if (reason === 'Not found') { res.status(404).json({ error: 'Not found' }); return }
  if (reason) { res.status(409).json({ error: reason }); return }

  // Movements are this component's own audit trail — they go with it.
  await prisma.$transaction([
    prisma.componentMovement.deleteMany({ where: { componentId: id } }),
    prisma.rawComponent.delete({ where: { id } }),
  ])
  res.status(204).end()
})

/** Bulk delete. Same guards as the single-row route, per component. */
router.post('/bulk-delete', requirePermission('component', 'delete'), async (req: AuthRequest, res) => {
  const { ids } = req.body as { ids?: string[] }
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'ids array required' }); return }

  const rows = await prisma.rawComponent.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, refNumber: true },
  })

  const deletable: string[] = []
  const blocked: { id: string; title: string; reason: string }[] = []
  for (const row of rows) {
    const reason = await blockedReason(row.id)
    if (reason) blocked.push({ id: row.id, title: row.refNumber ?? row.name, reason })
    else deletable.push(row.id)
  }

  if (deletable.length) {
    await prisma.$transaction([
      prisma.componentMovement.deleteMany({ where: { componentId: { in: deletable } } }),
      prisma.rawComponent.deleteMany({ where: { id: { in: deletable } } }),
    ])
  }

  res.json({ deleted: deletable.length, skipped: ids.length - rows.length, blocked })
})

export default router
