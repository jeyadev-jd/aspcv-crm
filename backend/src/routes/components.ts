import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
router.use(authenticate)

async function nextRefNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.rawComponent.count({ where: { refNumber: { startsWith: `RC-${year}-` } } })
  return `RC-${year}-${String(count + 1).padStart(4, '0')}`
}

router.get('/', async (req, res) => {
  const { status, category, oldestFirst } = req.query as Record<string, string>
  const components = await prisma.rawComponent.findMany({
    where: {
      ...(status && { status }),
      ...(category && { category }),
    },
    orderBy: oldestFirst === 'false' ? { receivedAt: 'desc' } : { receivedAt: 'asc' },
  })
  res.json(components)
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
  const { name, category, warrantyMonths, receivedAt, customFields, notes } = req.body
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
    },
  })

  await prisma.componentMovement.create({
    data: { componentId: component.id, type: 'received', performedById: req.user!.id, notes: 'Initial stock' },
  })

  res.status(201).json(component)
})

router.patch('/:id', requirePermission('component', 'edit'), async (req: AuthRequest, res) => {
  const { name, category, warrantyMonths, customFields, notes } = req.body
  const component = await prisma.rawComponent.update({
    where: { id: req.params.id as string },
    data: {
      ...(name && { name }),
      ...(category !== undefined && { category }),
      ...(warrantyMonths !== undefined && { warrantyMonths }),
      ...(customFields !== undefined && { customFields }),
      ...(notes !== undefined && { notes }),
    },
  })
  res.json(component)
})

// Assign to project/installation/lead
router.post('/:id/assign', requirePermission('component', 'assign'), async (req: AuthRequest, res) => {
  const { toEntityType, toEntityId, toEntityName, notes } = req.body

  const component = await prisma.rawComponent.update({
    where: { id: req.params.id as string },
    data: { status: 'assigned', assignedToType: toEntityType, assignedToId: toEntityId, assignedAt: new Date() },
  })

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

export default router
