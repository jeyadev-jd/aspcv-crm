import { createSafeRouter } from '../lib/safeRouter'
import bcrypt from 'bcrypt'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { userSchema } from '../lib/zod-schemas'
import { parsePagination, paginate } from '../lib/pagination'
import { rejectIfInactive } from '../lib/softDelete'

const router = createSafeRouter()

router.use(authenticate)

router.get('/', requirePermission('hr_user', 'read_all'), async (req: AuthRequest, res) => {
  const { includePending } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'name')
  const where = {
    ...(includePending === 'true' ? {} : { isActive: true }),
    ...(pagination.search && { name: { contains: pagination.search, mode: 'insensitive' as const } }),
  }
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, roleName: true, designation: true, isActive: true, dateOfBirth: true, joiningDate: true, department: { select: { id: true, name: true } }, departmentId: true, baseSalary: true, hra: true, allowances: true, pfApplicable: true, esiApplicable: true, pan: true, bankAccount: true, ifsc: true, bankName: true, emergencyContact: true, createdAt: true },
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.user.count({ where }),
  ])
  res.json(paginate(users, total, pagination))
})

router.post('/', requirePermission('hr_user', 'create'), async (req: AuthRequest, res) => {
  const data = userSchema.parse(req.body)
  const { password, dateOfBirth, joiningDate, ...rest } = data
  const passwordHash = await bcrypt.hash(password, 10)

  // Create user as INACTIVE — requires SuperAdmin approval
  const user = await prisma.user.create({
    data: {
      ...rest,
      role: rest.role as any,
      roleName: rest.role ?? 'Viewer',
      passwordHash,
      isActive: false, // Start inactive — will activate after approval
      ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
      ...(joiningDate && { joiningDate: new Date(joiningDate) }),
    },
    select: { id: true, name: true, email: true, role: true, roleName: true, designation: true, department: { select: { id: true, name: true } }, baseSalary: true, isActive: true }
  })

  // Create approval request for SuperAdmin to review
  await prisma.approvalRequest.create({
    data: {
      requestedById: req.user!.id,
      entityType: 'hr_user',
      entityId: user.id,
      action: 'activate',
      payload: { name: user.name, email: rest.email, role: user.roleName, salary: rest.baseSalary },
      reason: `New employee: ${user.name} (${rest.email}) — Salary: ${rest.baseSalary ?? 'Not set'}, Role: ${user.roleName}`,
    }
  })

  res.status(201).json({ ...user, status: 'pending_approval', message: 'User created. Awaiting admin approval to activate.' })
})

const EDITABLE_USER_FIELDS = [
  'name', 'email', 'designation', 'departmentId', 'baseSalary', 'hra', 'allowances',
  'pfApplicable', 'esiApplicable', 'pan', 'bankAccount', 'ifsc', 'bankName', 'emergencyContact',
] as const

router.patch('/:id', requirePermission('hr_user', 'edit'), async (req: AuthRequest, res) => {
  const existingUser = await prisma.user.findUnique({ where: { id: req.params.id as string } })
  if (!rejectIfInactive(existingUser, res)) return
  const body = req.body as Record<string, unknown>
  const update: Record<string, unknown> = {}
  for (const field of EDITABLE_USER_FIELDS) {
    if (body[field] !== undefined) update[field] = body[field]
  }
  if (body.password) update.passwordHash = await bcrypt.hash(body.password as string, 10)
  if (body.dateOfBirth !== undefined) update.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth as string) : null
  if (body.joiningDate !== undefined) update.joiningDate = body.joiningDate ? new Date(body.joiningDate as string) : null
  const user = await prisma.user.update({
    where: { id: req.params.id as string },
    data: update,
    select: { id: true, name: true, email: true, role: true, designation: true, department: { select: { id: true, name: true } }, departmentId: true }
  })
  res.json(user)
})

router.delete('/:id', requirePermission('hr_user', 'deactivate'), async (req: AuthRequest, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.isActive === false) { res.status(204).end(); return } // idempotent
  await prisma.user.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

router.post('/:id/restore', requirePermission('hr_user', 'deactivate'), async (req: AuthRequest, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const user = await prisma.user.update({
    where: { id: req.params.id as string },
    data: { isActive: true },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })
  res.json(user)
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
