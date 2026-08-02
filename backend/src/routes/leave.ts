import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { logAudit } from '../services/audit'
import { requireSuperAdminOrQueueApproval } from '../services/hrConfigApproval'

const router = createSafeRouter()
router.use(authenticate)

// ─── Leave Types (admin) ────────────────────────────────────────────────────

router.get('/types', async (_req: AuthRequest, res) => {
  const types = await prisma.leaveType.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  res.json(types)
})

router.post('/types', async (req: AuthRequest, res) => {
  const proceed = await requireSuperAdminOrQueueApproval(req, res, 'leave_type', 'create', req.body)
  if (!proceed) return
  const { code, name, annualQuota, monthlyAccrual, maxCarryForward, carryForwardExpiry,
    isEncashable, maxEncashment, isPaidLeave, requiresDocument, sandwichApplicable,
    halfDayAllowed, minDaysNotice, maxConsecutiveDays, gender, probationAllowed } = req.body

  if (!code || !name) return res.status(400).json({ error: 'Code and name required' })

  const lt = await prisma.leaveType.create({
    data: {
      code, name,
      annualQuota: annualQuota || 0,
      monthlyAccrual: monthlyAccrual || 0,
      maxCarryForward: maxCarryForward || 0,
      carryForwardExpiry: carryForwardExpiry || 0,
      isEncashable: isEncashable || false,
      maxEncashment: maxEncashment || 0,
      isPaidLeave: isPaidLeave !== false,
      requiresDocument: requiresDocument || false,
      sandwichApplicable: sandwichApplicable || false,
      halfDayAllowed: halfDayAllowed !== false,
      minDaysNotice: minDaysNotice || 0,
      maxConsecutiveDays: maxConsecutiveDays || 0,
      gender: gender || null,
      probationAllowed: probationAllowed || false,
    },
  })
  res.status(201).json(lt)
})

router.patch('/types/:id', async (req: AuthRequest, res) => {
  const proceed = await requireSuperAdminOrQueueApproval(req, res, 'leave_type', 'edit', { id: req.params.id, ...req.body })
  if (!proceed) return
  const lt = await prisma.leaveType.update({ where: { id: req.params.id as string }, data: req.body })
  res.json(lt)
})

router.delete('/types/:id', async (req: AuthRequest, res) => {
  const proceed = await requireSuperAdminOrQueueApproval(req, res, 'leave_type', 'delete', { id: req.params.id })
  if (!proceed) return
  await prisma.leaveType.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

// ─── Leave Balances ─────────────────────────────────────────────────────────

router.get('/balance', async (req: AuthRequest, res) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear()
  const balances = await prisma.leaveBalance.findMany({
    where: { userId: req.user!.id, year },
    include: { leaveType: { select: { code: true, name: true, annualQuota: true } } },
    orderBy: { leaveType: { sortOrder: 'asc' } },
  })
  res.json(balances)
})

// Org-wide balance grid for HR reporting: one row per user per leave type.
// Declared before /balance/:userId so the literal path is not captured as an id.
router.get('/balances/summary', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR', 'Manager', 'BusinessHead'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Access denied' })
  }
  const year = parseInt(req.query.year as string) || new Date().getFullYear()
  const departmentId = req.query.departmentId as string | undefined

  const balances = await prisma.leaveBalance.findMany({
    where: {
      year,
      ...(departmentId ? { user: { departmentId } } : {}),
    },
    include: {
      user: {
        select: { id: true, name: true, isActive: true, department: { select: { id: true, name: true } } },
      },
      leaveType: { select: { id: true, code: true, name: true, annualQuota: true } },
    },
    orderBy: [{ user: { name: 'asc' } }, { leaveType: { sortOrder: 'asc' } }],
  })

  res.json(balances.map(b => ({
    userId: b.userId,
    userName: b.user.name,
    isActive: b.user.isActive,
    department: b.user.department?.name ?? null,
    departmentId: b.user.department?.id ?? null,
    leaveTypeId: b.leaveTypeId,
    leaveTypeCode: b.leaveType.code,
    leaveTypeName: b.leaveType.name,
    // Entitlement is what they actually have available this year (carry-forward
    // and adjustments included), not just the leave type's headline quota.
    entitled: b.opening + b.accrued + b.carryForward + b.adjusted,
    annualQuota: b.leaveType.annualQuota,
    taken: b.taken,
    encashed: b.encashed,
    remaining: b.balance,
    year: b.year,
  })))
})

router.get('/balance/:userId', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR', 'Manager', 'BusinessHead'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Access denied' })
  }
  const year = parseInt(req.query.year as string) || new Date().getFullYear()
  const balances = await prisma.leaveBalance.findMany({
    where: { userId: req.params.userId as string, year },
    include: { leaveType: { select: { code: true, name: true, annualQuota: true } } },
  })
  res.json(balances)
})

// Initialize balances for a user (HR action or auto on year start)
router.post('/balance/initialize', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Only HR/Admin can initialize balances' })
  }
  const { userId, year } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const targetYear = year || new Date().getFullYear()

  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } })
  const existing = await prisma.leaveBalance.findMany({
    where: { userId, year: targetYear },
  })
  const existingCodes = new Set(existing.map(b => b.leaveTypeId))

  // Get previous year balances for carry forward
  const prevBalances = await prisma.leaveBalance.findMany({
    where: { userId, year: targetYear - 1 },
    include: { leaveType: true },
  })
  const prevMap = new Map(prevBalances.map(b => [b.leaveTypeId, b]))

  const created = []
  for (const lt of leaveTypes) {
    if (existingCodes.has(lt.id)) continue
    const prev = prevMap.get(lt.id)
    const cf = prev ? Math.min(prev.balance, lt.maxCarryForward) : 0

    const bal = await prisma.leaveBalance.create({
      data: {
        userId,
        leaveTypeId: lt.id,
        year: targetYear,
        opening: cf,
        carryForward: cf,
        accrued: lt.monthlyAccrual > 0 ? 0 : lt.annualQuota,
        balance: cf + (lt.monthlyAccrual > 0 ? 0 : lt.annualQuota),
      },
    })
    created.push(bal)
  }
  res.json({ created: created.length, balances: created })
})

// Monthly accrual (cron job or manual trigger)
router.post('/balance/accrue', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Only HR/Admin can trigger accrual' })
  }
  const year = new Date().getFullYear()
  const month = new Date().getMonth() + 1

  const leaveTypes = await prisma.leaveType.findMany({
    where: { isActive: true, monthlyAccrual: { gt: 0 } },
  })

  let updated = 0
  for (const lt of leaveTypes) {
    const balances = await prisma.leaveBalance.findMany({
      where: { leaveTypeId: lt.id, year },
    })
    for (const bal of balances) {
      const lastMonth = bal.lastAccrualDate ? bal.lastAccrualDate.getMonth() + 1 : 0
      if (lastMonth >= month) continue

      await prisma.leaveBalance.update({
        where: { id: bal.id },
        data: {
          accrued: { increment: lt.monthlyAccrual },
          balance: { increment: lt.monthlyAccrual },
          lastAccrualDate: new Date(),
        },
      })
      updated++
    }
  }
  res.json({ message: `Accrued for ${updated} balances` })
})

// ─── Leave Requests ─────────────────────────────────────────────────────────

router.get('/requests', async (req: AuthRequest, res) => {
  const { status, userId } = req.query
  const isAdmin = ['SuperAdmin', 'HR', 'Manager', 'BusinessHead'].includes(req.user?.roleName || '')

  const where: any = {}
  if (!isAdmin) {
    where.userId = req.user!.id
  } else if (userId) {
    where.userId = userId
  }
  if (status) where.status = status

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, departmentId: true, department: { select: { name: true } } } },
      leaveType: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  res.json(requests)
})

router.post('/requests', async (req: AuthRequest, res) => {
  const { leaveTypeId, fromDate, toDate, reason, halfDayDate, halfDaySession, documentUrl, compOffDate } = req.body

  if (!leaveTypeId || !fromDate || !toDate || !reason) {
    return res.status(400).json({ error: 'leaveTypeId, fromDate, toDate, reason required' })
  }

  const lt = await prisma.leaveType.findUniqueOrThrow({ where: { id: leaveTypeId } })
  const from = new Date(fromDate)
  const to = new Date(toDate)

  if (to < from) {
    return res.status(400).json({ error: 'toDate cannot be before fromDate' })
  }

  if (halfDayDate) {
    if (!lt.halfDayAllowed) {
      return res.status(400).json({ error: `${lt.name} does not allow half-day leave` })
    }
    const half = new Date(halfDayDate)
    if (half < from || half > to) {
      return res.status(400).json({ error: 'halfDayDate must fall within fromDate and toDate' })
    }
    if (!halfDaySession) {
      return res.status(400).json({ error: 'halfDaySession (first/second) is required when halfDayDate is set' })
    }
    if (!['first', 'second'].includes(halfDaySession)) {
      return res.status(400).json({ error: "halfDaySession must be 'first' or 'second'" })
    }
  } else if (halfDaySession) {
    return res.status(400).json({ error: 'halfDayDate is required when halfDaySession is set' })
  }

  // Calculate working days
  let totalDays = 0
  let sandwichDays = 0
  const holidays = await prisma.holidayCalendar.findMany({
    where: { year: from.getFullYear(), isActive: true },
  })
  const holidayDates = new Set(holidays.map(h => h.date.toISOString().slice(0, 10)))

  const settings = await prisma.attendanceSettings.findFirst({ where: { isActive: true } })
  const weeklyOff: string[] = settings ? JSON.parse(JSON.stringify(settings.weeklyOff)) : ['Sunday']
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const halfDayStr = halfDayDate ? new Date(halfDayDate).toISOString().slice(0, 10) : null
  let halfDayIsWorking = false

  const current = new Date(from)
  while (current <= to) {
    const dateStr = current.toISOString().slice(0, 10)
    const dayName = dayNames[current.getDay()]
    const isOff = weeklyOff.includes(dayName) || holidayDates.has(dateStr)

    if (!isOff) {
      totalDays++
      if (dateStr === halfDayStr) halfDayIsWorking = true
    } else if (lt.sandwichApplicable) {
      sandwichDays++
    }

    current.setDate(current.getDate() + 1)
  }

  // Half day adjustment — only deduct when the chosen date is actually a
  // working day, otherwise the request would be short by half a day.
  if (halfDayStr) {
    if (!halfDayIsWorking) {
      return res.status(400).json({ error: 'halfDayDate falls on a weekly off or holiday' })
    }
    totalDays -= 0.5
  }

  // Sandwich rule: if leave surrounds weekends/holidays, count them
  if (lt.sandwichApplicable && sandwichDays > 0) {
    totalDays += sandwichDays
  }

  if (totalDays <= 0) {
    return res.status(400).json({ error: 'Selected range contains no working days' })
  }

  // Check balance. Half Day has no quota — it is unlimited and governed purely
  // by approval, so it never fails on balance.
  const year = from.getFullYear()
  const isUnlimited = lt.code === 'HD'
  const balance = await prisma.leaveBalance.findFirst({
    where: { userId: req.user!.id, leaveTypeId, year },
  })

  if (!isUnlimited && balance && balance.balance < totalDays && lt.isPaidLeave) {
    return res.status(400).json({
      error: `Insufficient leave balance. Available: ${balance.balance}, Requested: ${totalDays}`,
    })
  }

  const request = await prisma.leaveRequest.create({
    data: {
      userId: req.user!.id,
      leaveTypeId,
      fromDate: from,
      toDate: to,
      totalDays,
      halfDayDate: halfDayDate ? new Date(halfDayDate) : null,
      halfDaySession: halfDaySession || null,
      reason,
      documentUrl: documentUrl || null,
      sandwichDays,
      compOffDate: compOffDate ? new Date(compOffDate) : null,
      status: 'Pending',
    },
    include: { leaveType: { select: { code: true, name: true } } },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'Leave',
    entityId: request.id, newValue: { type: lt.name, days: totalDays, from: fromDate, to: toDate },
  })

  res.status(201).json(request)
})

// Approve leave
router.patch('/requests/:id/approve', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR', 'Manager', 'BusinessHead', 'ProjectHead'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Not authorized to approve leaves' })
  }

  const request = await prisma.leaveRequest.findUniqueOrThrow({
    where: { id: req.params.id as string },
    include: { leaveType: true },
  })

  if (request.status !== 'Pending') {
    return res.status(400).json({ error: 'Only pending requests can be approved' })
  }

  if (request.userId === req.user!.id) {
    return res.status(400).json({ error: 'Cannot approve your own leave request' })
  }

  // Half Day is unlimited, so it records usage without drawing down a balance
  // that would otherwise go negative.
  const isUnlimited = request.leaveType.code === 'HD'

  await prisma.$transaction([
    prisma.leaveRequest.update({
      where: { id: request.id },
      data: { status: 'Approved', approvedById: req.user!.id, approvedAt: new Date() },
    }),
    prisma.leaveBalance.updateMany({
      where: { userId: request.userId, leaveTypeId: request.leaveTypeId, year: request.fromDate.getFullYear() },
      data: isUnlimited
        ? { taken: { increment: request.totalDays } }
        : { taken: { increment: request.totalDays }, balance: { decrement: request.totalDays } },
    }),
  ])

  // Mark attendance records as leave. The half-day date is marked 'half_day'
  // instead — the employee works the other half, and payroll treats an
  // approved half day as paid rather than loss of pay.
  const halfDayStr = request.halfDayDate ? request.halfDayDate.toISOString().slice(0, 10) : null
  const current = new Date(request.fromDate)
  while (current <= request.toDate) {
    const dateStr = current.toISOString().slice(0, 10)
    const isHalf = dateStr === halfDayStr
    const status = isHalf ? 'half_day' : 'leave'
    const note = isHalf
      ? `${request.leaveType.name} approved (half day${request.halfDaySession ? ` — ${request.halfDaySession} half` : ''})`
      : `${request.leaveType.name} approved`
    await prisma.attendanceRecord.upsert({
      where: { userId_date: { userId: request.userId, date: new Date(dateStr) } },
      update: { status, notes: note },
      create: { userId: request.userId, date: new Date(dateStr), status, notes: note },
    })
    current.setDate(current.getDate() + 1)
  }

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'approve', module: 'Leave',
    entityId: request.id, newValue: { days: request.totalDays },
  })

  res.json({ message: 'Leave approved', days: request.totalDays })
})

// Reject leave
router.patch('/requests/:id/reject', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR', 'Manager', 'BusinessHead', 'ProjectHead'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Not authorized' })
  }

  const { reason } = req.body
  if (!reason) return res.status(400).json({ error: 'Rejection reason required' })

  const request = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: req.params.id as string } })
  if (request.status !== 'Pending') {
    return res.status(400).json({ error: 'Only pending requests can be rejected' })
  }

  await prisma.leaveRequest.update({
    where: { id: request.id },
    data: { status: 'Rejected', rejectedById: req.user!.id, rejectedAt: new Date(), rejectReason: reason },
  })

  res.json({ message: 'Leave rejected' })
})

// Cancel leave (by employee)
router.patch('/requests/:id/cancel', async (req: AuthRequest, res) => {
  const request = await prisma.leaveRequest.findUniqueOrThrow({
    where: { id: req.params.id as string },
    include: { leaveType: { select: { code: true } } },
  })

  if (request.userId !== req.user!.id) {
    return res.status(403).json({ error: 'Can only cancel own leave' })
  }

  if (!['Pending', 'Approved'].includes(request.status)) {
    return res.status(400).json({ error: 'Cannot cancel this request' })
  }

  // If was approved, reverse what approval recorded. Half Day never drew down
  // a balance, so only its usage counter is rolled back.
  if (request.status === 'Approved') {
    const isUnlimited = request.leaveType.code === 'HD'
    await prisma.leaveBalance.updateMany({
      where: { userId: request.userId, leaveTypeId: request.leaveTypeId, year: request.fromDate.getFullYear() },
      data: isUnlimited
        ? { taken: { decrement: request.totalDays } }
        : { taken: { decrement: request.totalDays }, balance: { increment: request.totalDays } },
    })
  }

  await prisma.leaveRequest.update({
    where: { id: request.id },
    data: { status: 'Cancelled', cancelledAt: new Date(), cancelReason: req.body.reason || 'Cancelled by employee' },
  })

  res.json({ message: 'Leave cancelled' })
})

// ─── Holiday Calendar ───────────────────────────────────────────────────────

router.get('/holidays', async (req: AuthRequest, res) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear()
  const holidays = await prisma.holidayCalendar.findMany({
    where: { year, isActive: true },
    orderBy: { date: 'asc' },
  })
  res.json(holidays)
})

router.post('/holidays', async (req: AuthRequest, res) => {
  if (req.user?.roleName !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Only SuperAdmin can create holidays' })
  }
  const { name, date, type, isOptional } = req.body
  if (!name || !date) return res.status(400).json({ error: 'name and date required' })

  const d = new Date(date)
  const holiday = await prisma.holidayCalendar.create({
    data: { name, date: d, type: type || 'public', isOptional: isOptional || false, year: d.getFullYear() },
  })
  res.status(201).json(holiday)
})

router.patch('/holidays/:id', async (req: AuthRequest, res) => {
  if (req.user?.roleName !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Only SuperAdmin can edit holidays' })
  }
  const { name, date, type, isOptional, isActive } = req.body
  const data: any = {}
  if (name !== undefined) data.name = name
  if (date !== undefined) { data.date = new Date(date); data.year = new Date(date).getFullYear() }
  if (type !== undefined) data.type = type
  if (isOptional !== undefined) data.isOptional = isOptional
  if (isActive !== undefined) data.isActive = isActive
  const holiday = await prisma.holidayCalendar.update({ where: { id: req.params.id as string }, data })
  res.json(holiday)
})

router.delete('/holidays/:id', async (req: AuthRequest, res) => {
  if (req.user?.roleName !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Only SuperAdmin can delete holidays' })
  }
  await prisma.holidayCalendar.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

// ─── Attendance Settings ────────────────────────────────────────────────────

router.get('/attendance-settings', async (_req: AuthRequest, res) => {
  const settings = await prisma.attendanceSettings.findFirst({ where: { isActive: true } })
  res.json(settings || {})
})

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

router.put('/attendance-settings', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Only HR/Admin' })
  }
  if (req.body.weeklyOff !== undefined) {
    if (!Array.isArray(req.body.weeklyOff) || req.body.weeklyOff.some((d: unknown) => !WEEK_DAYS.includes(d as string))) {
      return res.status(400).json({ error: `weeklyOff must be an array of: ${WEEK_DAYS.join(', ')}` })
    }
  }
  const existing = await prisma.attendanceSettings.findFirst({ where: { isActive: true } })
  const data = {
    officeStartTime: req.body.officeStartTime,
    officeEndTime: req.body.officeEndTime,
    gracePeriodMinutes: req.body.gracePeriodMinutes,
    halfDayHours: req.body.halfDayHours,
    fullDayHours: req.body.fullDayHours,
    weeklyOff: req.body.weeklyOff,
    lateMarkAfterGrace: req.body.lateMarkAfterGrace,
    autoAbsentOnNoCheckIn: req.body.autoAbsentOnNoCheckIn,
    gpsRequired: req.body.gpsRequired,
    gpsRadiusMeters: req.body.gpsRadiusMeters,
  }

  if (existing) {
    const updated = await prisma.attendanceSettings.update({ where: { id: existing.id }, data })
    res.json(updated)
  } else {
    const created = await prisma.attendanceSettings.create({ data: { ...data, isActive: true } })
    res.json(created)
  }
})

// ─── Late-to-LOP Rules ─────────────────────────────────────────────────────

router.get('/late-lop-rules', async (_req: AuthRequest, res) => {
  const rules = await prisma.lateLopRule.findMany({
    where: { isActive: true },
    orderBy: { lateCount: 'asc' },
  })
  res.json(rules)
})

router.post('/late-lop-rules', async (req: AuthRequest, res) => {
  const proceed = await requireSuperAdminOrQueueApproval(req, res, 'late_lop_rule', 'upsert', req.body)
  if (!proceed) return
  const { lateCount, lopDays } = req.body
  if (!lateCount || lopDays === undefined) return res.status(400).json({ error: 'lateCount and lopDays required' })

  const rule = await prisma.lateLopRule.upsert({
    where: { lateCount },
    update: { lopDays },
    create: { lateCount, lopDays },
  })
  res.json(rule)
})

router.delete('/late-lop-rules/:id', async (req: AuthRequest, res) => {
  const proceed = await requireSuperAdminOrQueueApproval(req, res, 'late_lop_rule', 'delete', { id: req.params.id })
  if (!proceed) return
  await prisma.lateLopRule.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

export default router
