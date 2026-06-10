import { Router } from 'express'
import bcrypt from 'bcrypt'
import prisma from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { loginSchema } from '../lib/zod-schemas'

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
  const token = signToken({ id: user.id, role: user.role })
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, designation: user.designation?.name }
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
    res.json({ token: signToken({ id: user.id, role: user.role }) })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

export default router
