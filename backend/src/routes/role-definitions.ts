import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { invalidate } from '../services/permissions-cache'
import { rejectIfInactive } from '../lib/softDelete'

const router = createSafeRouter()
router.use(authenticate)
router.use(requirePermission('role_admin', 'manage'))

// GET — list all active roles with permissions
router.get('/', async (_req, res) => {
  const roles = await prisma.roleDefinition.findMany({
    where: { isActive: true },
    include: { permissions: true },
    orderBy: { sortOrder: 'asc' },
  })
  res.json(roles)
})

// POST — create custom role
router.post('/', async (req, res) => {
  const { name, displayName } = req.body as { name: string; displayName: string }
  if (!name || !displayName) { res.status(400).json({ error: 'name and displayName required' }); return }
  const rd = await prisma.roleDefinition.create({ data: { name, displayName, isSystem: false } })
  res.status(201).json(rd)
})

// PATCH /:id — rename displayName / reorder (name immutable)
router.patch('/:id', async (req, res) => {
  const existing = await prisma.roleDefinition.findUnique({ where: { id: req.params.id } })
  if (!rejectIfInactive(existing, res)) return
  const { displayName, sortOrder } = req.body as { displayName?: string; sortOrder?: number }
  const rd = await prisma.roleDefinition.update({
    where: { id: req.params.id },
    data: { ...(displayName && { displayName }), ...(sortOrder !== undefined && { sortOrder }) },
  })
  res.json(rd)
})

// DELETE /:id — soft delete custom roles only
router.delete('/:id', async (req, res) => {
  const rd = await prisma.roleDefinition.findUnique({ where: { id: req.params.id } })
  if (!rd) { res.status(404).json({ error: 'Not found' }); return }
  if (rd.isSystem) { res.status(400).json({ error: 'Cannot delete system role' }); return }
  if (rd.isActive === false) { res.status(204).end(); return } // idempotent
  await prisma.roleDefinition.update({ where: { id: req.params.id }, data: { isActive: false } })
  res.status(204).end()
})

router.post('/:id/restore', async (req, res) => {
  const rd = await prisma.roleDefinition.findUnique({ where: { id: req.params.id } })
  if (!rd) { res.status(404).json({ error: 'Not found' }); return }
  const restored = await prisma.roleDefinition.update({ where: { id: req.params.id }, data: { isActive: true } })
  res.json(restored)
})

// PUT /:id/permissions — replace full permission set
router.put('/:id/permissions', async (req, res) => {
  const { permissions } = req.body as { permissions: { resource: string; action: string; allowed: boolean }[] }
  await prisma.rolePermission.deleteMany({ where: { roleDefinitionId: req.params.id } })
  if (permissions?.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissions.map(p => ({ ...p, roleDefinitionId: req.params.id })),
    })
  }
  const users = await prisma.user.findMany({ where: { roleName: (await prisma.roleDefinition.findUnique({ where: { id: req.params.id } }))?.name ?? '' }, select: { id: true } })
  users.forEach(u => invalidate(u.id))
  res.json({ updated: permissions?.length ?? 0 })
})

// PATCH /:id/permissions/:resource/:action — toggle single permission
router.patch('/:id/permissions/:resource/:action', async (req, res) => {
  const { allowed } = req.body as { allowed: boolean }
  const { id, resource, action } = req.params
  const perm = await prisma.rolePermission.upsert({
    where: { roleDefinitionId_resource_action: { roleDefinitionId: id, resource, action } },
    update: { allowed },
    create: { roleDefinitionId: id, resource, action, allowed },
  })
  const rd = await prisma.roleDefinition.findUnique({ where: { id } })
  if (rd) {
    const users = await prisma.user.findMany({ where: { roleName: rd.name }, select: { id: true } })
    users.forEach(u => invalidate(u.id))
  }
  res.json(perm)
})

export default router
