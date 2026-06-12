import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { invalidate } from '../services/permissions-cache'

const router = Router()
router.use(authenticate)
router.use(requirePermission('role_admin', 'manage'))

// GET /:userId — list overrides for a user
router.get('/:userId', async (req, res) => {
  const overrides = await prisma.userPermissionOverride.findMany({
    where: { userId: req.params.userId },
    include: { grantedBy: { select: { id: true, name: true } } },
  })
  res.json(overrides)
})

// PUT /:userId/:resource/:action — upsert override
router.put('/:userId/:resource/:action', async (req: AuthRequest, res) => {
  const { allowed, reason } = req.body as { allowed: boolean; reason?: string }
  const userId = req.params.userId as string
  const resource = req.params.resource as string
  const action = req.params.action as string
  const override = await prisma.userPermissionOverride.upsert({
    where: { userId_resource_action: { userId, resource, action } },
    update: { allowed, reason, grantedById: req.user!.id },
    create: { userId, resource, action, allowed, reason, grantedById: req.user!.id },
  })
  invalidate(userId)
  res.json(override)
})

// DELETE /:userId/:resource/:action — remove override
router.delete('/:userId/:resource/:action', async (req, res) => {
  const userId = req.params.userId as string
  const resource = req.params.resource as string
  const action = req.params.action as string
  await prisma.userPermissionOverride.deleteMany({ where: { userId, resource, action } })
  invalidate(userId)
  res.status(204).end()
})

// PATCH /:userId/role — assign role to user
router.patch('/:userId/role', async (req, res) => {
  const { roleName } = req.body as { roleName: string }
  const rd = await prisma.roleDefinition.findUnique({ where: { name: roleName, isActive: true } })
  if (!rd) { res.status(400).json({ error: 'Invalid role' }); return }
  const user = await prisma.user.update({
    where: { id: req.params.userId },
    data: { roleName },
    select: { id: true, name: true, roleName: true },
  })
  invalidate(req.params.userId)
  res.json(user)
})

export default router
