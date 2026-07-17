import { Router } from 'express'
import bcrypt from 'bcrypt'
import prisma from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { loginSchema } from '../lib/zod-schemas'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

router.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)
  const user = await prisma.user.findUnique({ where: { email }, include: { designation: true } })
  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }
  const token = signToken({ id: user.id, role: user.role, roleName: user.roleName })
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, roleName: user.roleName, designation: user.designation?.name }
  })
})

router.post('/refresh', async (req, res) => {
  const { token } = req.body as { token?: string }
  if (!token) { res.status(400).json({ error: 'Token required' }); return }
  try {
    const { verifyToken } = await import('../lib/jwt')
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({ where: { id: payload.id } })
    if (!user || !user.isActive) { res.status(401).json({ error: 'User not found' }); return }
    res.json({ token: signToken({ id: user.id, role: user.role, roleName: user.roleName }) })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

// GET /api/auth/my-permissions — flat permission map for frontend
router.get('/my-permissions', authenticate, async (req: AuthRequest, res) => {
  const { id: userId, roleName } = req.user!

  const map: Record<string, boolean> = {}

  if (roleName === 'SuperAdmin') {
    map['*'] = true
  } else {
    const rolePerms = await prisma.rolePermission.findMany({
      where: { roleDefinition: { name: roleName }, allowed: true },
      select: { resource: true, action: true },
    })
    for (const p of rolePerms) {
      map[`${p.resource}:${p.action}`] = true
      // `read_all` is a superset of `read_own` — mirrors the same rule in
      // resolvePermission() so the sidebar/UI doesn't hide things a read_all
      // role can actually access via the API.
      if (p.action === 'read_all') map[`${p.resource}:read_own`] = true
    }
    const overrides = await prisma.userPermissionOverride.findMany({
      where: { userId },
      select: { resource: true, action: true, allowed: true },
    })
    for (const o of overrides) {
      map[`${o.resource}:${o.action}`] = o.allowed
    }
  }

  res.json(map)
})

export default router
