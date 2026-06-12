import { Router } from 'express'
import bcrypt from 'bcrypt'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { userSchema } from '../lib/zod-schemas'

const router = Router()

router.use(authenticate)

router.get('/', requirePermission('hr_user', 'read_all'), async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, designation: true, isActive: true, dateOfBirth: true, joiningDate: true, department: true, baseSalary: true, hra: true, allowances: true, pfApplicable: true, esiApplicable: true, pan: true, bankAccount: true, ifsc: true, bankName: true, emergencyContact: true, createdAt: true },
    orderBy: { name: 'asc' }
  })
  res.json(users)
})

router.post('/', requirePermission('hr_user', 'create'), async (req: AuthRequest, res) => {
  const data = userSchema.parse(req.body)
  const { password, dateOfBirth, joiningDate, ...rest } = data
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      ...rest,
      role: rest.role as any,
      roleName: rest.role ?? 'Viewer',
      passwordHash,
      ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
      ...(joiningDate && { joiningDate: new Date(joiningDate) }),
    },
    select: { id: true, name: true, email: true, role: true, designation: true }
  })
  res.status(201).json(user)
})

router.patch('/:id', requirePermission('hr_user', 'edit'), async (req: AuthRequest, res) => {
  const { password, dateOfBirth, joiningDate, designation, ...rest } = req.body as Record<string, unknown>
  const update: Record<string, unknown> = { ...rest }
  if (password) update.passwordHash = await bcrypt.hash(password as string, 10)
  if (dateOfBirth !== undefined) update.dateOfBirth = dateOfBirth ? new Date(dateOfBirth as string) : null
  if (joiningDate !== undefined) update.joiningDate = joiningDate ? new Date(joiningDate as string) : null
  const user = await prisma.user.update({
    where: { id: req.params.id as string },
    data: update,
    select: { id: true, name: true, email: true, role: true, designation: true }
  })
  res.json(user)
})

router.delete('/:id', requirePermission('hr_user', 'deactivate'), async (req: AuthRequest, res) => {
  await prisma.user.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

// Designations
router.get('/designations', async (_req, res) => {
  res.json(await prisma.designation.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }))
})

router.post('/designations', requirePermission('hr_user', 'edit'), async (req: AuthRequest, res) => {
  const { name } = req.body as { name: string }
  const d = await prisma.designation.upsert({ where: { name }, update: { isActive: true }, create: { name } })
  res.status(201).json(d)
})

export default router
