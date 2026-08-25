import { createSafeRouter } from '../lib/safeRouter'
import bcrypt from 'bcrypt'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { userSchema, strongPassword } from '../lib/zod-schemas'
import { parsePagination, paginate } from '../lib/pagination'
import { rejectIfInactive } from '../lib/softDelete'
import { encryptIfPresent, decryptIfPresent } from '../lib/encrypt'

const router = createSafeRouter()

router.use(authenticate)

router.get('/', requirePermission('hr_user', 'read_all'), async (req: AuthRequest, res) => {
  const { includePending, all } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'name')
  const where = {
    ...(includePending === 'true' ? {} : { isActive: true }),
    ...(pagination.search && { name: { contains: pagination.search, mode: 'insensitive' as const } }),
  }
  // `all=true` bypasses MAX_PAGE_SIZE: the HR directory and payroll screens
  // load the full roster to compute company-wide totals, and a silently
  // truncated list under-reports them past 100 employees.
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, roleName: true, designation: true, isActive: true, dateOfBirth: true, joiningDate: true, department: { select: { id: true, name: true } }, departmentId: true, baseSalary: true, hra: true, allowances: true, pfApplicable: true, esiApplicable: true, uan: true, esiNumber: true, pan: true, bankAccount: true, ifsc: true, bankName: true, emergencyContact: true, createdAt: true, employeeCode: true, masterGross: true, masterBasic: true, masterHra: true, masterOthers: true, masterSpecial1: true, masterSpecial2: true, variablePayPa: true, probationDays: true, priorExperienceMonths: true, dorLetterDate: true, lastWorkingDate: true, confirmationDate: true },
      orderBy: { [pagination.sort as string]: pagination.order },
      ...(all === 'true' ? {} : { skip: pagination.skip, take: pagination.take }),
    }),
    prisma.user.count({ where }),
  ])
  const decrypted = users.map(u => ({
    ...u,
    pan: decryptIfPresent(u.pan),
    bankAccount: decryptIfPresent(u.bankAccount),
    ifsc: decryptIfPresent(u.ifsc),
  }))
  res.json(paginate(decrypted, total, pagination))
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
      mustChangePassword: true, // force password change + OTP verification on first login
      ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
      ...(joiningDate && { joiningDate: new Date(joiningDate) }),
    },
    select: { id: true, name: true, email: true, role: true, roleName: true, designation: true, department: { select: { id: true, name: true } }, baseSalary: true, isActive: true, uan: true, esiNumber: true }
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
  'pfApplicable', 'esiApplicable', 'uan', 'esiNumber', 'pan', 'bankAccount', 'ifsc', 'bankName', 'emergencyContact',
  // Master salary (Salary Model.xlsx cols U-Z, AJ). Basic/HRA/Others are the
  // 50/25/25 split of masterGross but stay individually editable, matching the
  // workbook where each cell can be overridden.
  'masterGross', 'masterBasic', 'masterHra', 'masterOthers',
  'masterSpecial1', 'masterSpecial2', 'variablePayPa',
  // Employment lifecycle
  'employeeCode', 'probationDays', 'priorExperienceMonths',
] as const

// These feed every payroll calculation directly. A non-finite or negative
// value here (NaN, a stray minus sign, a string that happened to coerce)
// propagates straight into net pay, CTC and statutory contributions with no
// downstream check - the engine trusts what it reads off the user record.
const NUMERIC_SALARY_FIELDS = [
  'baseSalary', 'hra', 'allowances',
  'masterGross', 'masterBasic', 'masterHra', 'masterOthers',
  'masterSpecial1', 'masterSpecial2', 'variablePayPa',
  'probationDays', 'priorExperienceMonths',
] as const

/** Lifecycle dates parsed out of the body separately from the scalar fields. */
const EDITABLE_USER_DATES = ['dorLetterDate', 'lastWorkingDate', 'confirmationDate', 'probationEndDate'] as const

router.patch('/:id', requirePermission('hr_user', 'edit'), async (req: AuthRequest, res) => {
  const existingUser = await prisma.user.findUnique({ where: { id: req.params.id as string } })
  if (!rejectIfInactive(existingUser, res)) return
  const body = req.body as Record<string, unknown>

  for (const field of NUMERIC_SALARY_FIELDS) {
    const v = body[field]
    if (v === undefined || v === null) continue // clearing the field is fine
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) {
      res.status(400).json({ error: `${field} must be a non-negative number` })
      return
    }
    body[field] = n // normalise so a numeric string can't slip through as-is
  }

  const update: Record<string, unknown> = {}
  for (const field of EDITABLE_USER_FIELDS) {
    if (body[field] !== undefined) {
      if (field === 'pan' || field === 'bankAccount' || field === 'ifsc') {
        update[field] = encryptIfPresent(body[field] as string)
      } else {
        update[field] = body[field]
      }
    }
  }
  if (body.password) {
    update.passwordHash = await bcrypt.hash(body.password as string, 10)
    update.tokenVersion = { increment: 1 }
  }
  if (body.dateOfBirth !== undefined) update.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth as string) : null
  if (body.joiningDate !== undefined) update.joiningDate = body.joiningDate ? new Date(body.joiningDate as string) : null
  for (const field of EDITABLE_USER_DATES) {
    if (body[field] !== undefined) update[field] = body[field] ? new Date(body[field] as string) : null
  }

  // DOJ must not fall after the last working day. Checked against the merged
  // result rather than the payload alone, so changing either date in isolation
  // still gets validated against the stored value of the other.
  const doj = (update.joiningDate as Date | null | undefined) ?? existingUser!.joiningDate
  const dol = (update.lastWorkingDate as Date | null | undefined) ?? existingUser!.lastWorkingDate
  if (doj && dol && dol < doj) {
    res.status(400).json({ error: 'Last working date cannot precede the joining date' })
    return
  }

  const user = await prisma.user.update({
    where: { id: req.params.id as string },
    data: update,
    select: { id: true, name: true, email: true, role: true, designation: true, department: { select: { id: true, name: true } }, departmentId: true }
  })
  res.json(user)
})

// Self-service password change — any authenticated user, invalidates all other sessions
router.post('/:id/change-password', async (req: AuthRequest, res) => {
  const targetId = req.params.id as string
  const isSelf = req.user!.id === targetId
  const isAdmin = ['SuperAdmin'].includes(req.user!.roleName)
  if (!isSelf && !isAdmin) { res.status(403).json({ error: 'You can only change your own password' }); return }

  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword: string }
  // Same policy as account creation - a change path must not be able to weaken
  // a password below what the create path would have accepted.
  const pw = strongPassword.safeParse(newPassword)
  if (!pw.success) { res.status(400).json({ error: pw.error.issues[0]?.message ?? 'Password does not meet requirements' }); return }

  const user = await prisma.user.findUnique({ where: { id: targetId } })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  // Require current password verification for self-change (not for admin override)
  if (isSelf) {
    if (!currentPassword) { res.status(400).json({ error: 'Current password required' }); return }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) { res.status(400).json({ error: 'Current password is incorrect' }); return }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { passwordHash, tokenVersion: { increment: 1 } },
    select: { id: true, tokenVersion: true },
  })

  // Issue fresh token for self so they're not immediately logged out
  if (isSelf) {
    const token = (await import('../lib/jwt')).signToken({
      id: user.id, role: user.role, roleName: user.roleName, tokenVersion: updated.tokenVersion
    })
    res.json({ message: 'Password changed — all other sessions invalidated.', token })
    return
  }
  res.json({ message: 'Password updated. User must log in again.' })
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
