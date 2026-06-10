import { Router } from 'express'
import bcrypt from 'bcrypt'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { userSchema } from '../lib/zod-schemas'

const router = Router()

router.use(authenticate)

router.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, designation: true, createdAt: true },
    orderBy: { name: 'asc' }
  })
  res.json(users)
})

router.post('/', requireRole('Admin'), async (req, res) => {
  const data = userSchema.parse(req.body)
  const passwordHash = await bcrypt.hash(data.password, 10)
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash, role: data.role as any, designationId: data.designationId },
    select: { id: true, name: true, email: true, role: true, designation: true }
  })
  res.status(201).json(user)
})

router.patch('/:id', requireRole('Admin'), async (req, res) => {
  const { password, ...rest } = req.body as { password?: string; [k: string]: unknown }
  const update: Record<string, unknown> = { ...rest }
  if (password) update.passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.update({
    where: { id: req.params.id as string },
    data: update,
    select: { id: true, name: true, email: true, role: true, designation: true }
  })
  res.json(user)
})

router.delete('/:id', requireRole('Admin'), async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

// Designations
router.get('/designations', async (_req, res) => {
  res.json(await prisma.designation.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }))
})

router.post('/designations', requireRole('Admin'), async (req, res) => {
  const { name } = req.body as { name: string }
  const d = await prisma.designation.upsert({ where: { name }, update: { isActive: true }, create: { name } })
  res.status(201).json(d)
})

export default router
