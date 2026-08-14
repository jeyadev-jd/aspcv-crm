import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission, resolvePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { calculatePayroll, PayrollValidationError } from '../services/payroll/engine'
import {
  runForEmployee,
  runForAll,
  approvePeriod,
  reopenPeriod,
  markPeriodPaid,
  ensurePeriod,
} from '../services/payroll/periodService'
import { cycleWindow } from '../services/payroll/period'
import { generatePayrollPayslipPdf } from '../services/payslip'

const router = createSafeRouter()
router.use(authenticate)

/** Payroll figures are confidential: an employee may only ever see their own. */
async function canViewOthers(req: AuthRequest): Promise<boolean> {
  return resolvePermission(req.user!.id, req.user!.roleName, 'salary', 'read_all')
}

function handleError(err: unknown, res: { status: (n: number) => { json: (b: unknown) => unknown } }) {
  if (err instanceof PayrollValidationError) {
    return res.status(400).json({ error: err.message })
  }
  throw err
}

/** Derived lifecycle/experience values, computed rather than stored. */
function months(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()))
}

// ─── Employee directory ──────────────────────────────────────────────────────

/**
 * Directory rows. Salary columns are only attached for callers with
 * salary:read_all - everyone else gets the non-confidential fields.
 */
router.get('/directory', requirePermission('user', 'read_all'), async (req: AuthRequest, res) => {
  const { search, status, departmentId, month, year } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>)
  const showSalary = await canViewOthers(req)

  const where = {
    ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { employeeCode: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { department: true, designation: true },
      orderBy: { name: 'asc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.user.count({ where }),
  ])

  const m = month ? parseInt(month, 10) : new Date().getMonth() + 1
  const y = year ? parseInt(year, 10) : new Date().getFullYear()
  const { cycleStart, cycleEnd } = cycleWindow(m, y)

  // Payroll figures come from the stored records for the selected period, so
  // the directory shows what was actually calculated rather than recomputing.
  const period = await prisma.payrollPeriod.findUnique({ where: { month_year: { month: m, year: y } } })
  const records = period
    ? await prisma.payrollRecord.findMany({
        where: { periodId: period.id, isCurrent: true, userId: { in: users.map((u) => u.id) } },
      })
    : []
  const byUser = new Map(records.map((r) => [r.userId, r]))

  const now = new Date()
  const rows = users.map((u) => {
    const rec = byUser.get(u.id)
    const base = {
      id: u.id,
      employeeCode: u.employeeCode,
      name: u.name,
      email: u.email,
      designation: u.designation?.name ?? null,
      department: u.department?.name ?? null,
      role: u.roleName,
      isActive: u.isActive,
      // Employment lifecycle
      dateOfBirth: u.dateOfBirth,
      joiningDate: u.joiningDate,
      probationDays: u.probationDays,
      confirmationDate:
        u.confirmationDate ??
        (u.joiningDate && u.probationDays
          ? new Date(u.joiningDate.getTime() + u.probationDays * 86400000)
          : null),
      dorLetterDate: u.dorLetterDate,
      lastWorkingDate: u.lastWorkingDate,
      // Derived experience (never stored as editable text)
      priorExperienceMonths: u.priorExperienceMonths ?? 0,
      experienceInAspcvMonths: u.joiningDate ? months(u.joiningDate, u.lastWorkingDate ?? now) : 0,
      lifecycle: rec?.lifecycle ?? null,
      isJoiner: !!u.joiningDate && u.joiningDate >= cycleStart && u.joiningDate <= cycleEnd,
      isLeaver: !!u.lastWorkingDate && u.lastWorkingDate >= cycleStart && u.lastWorkingDate <= cycleEnd,
    }

    if (!showSalary) return base
    return {
      ...base,
      masterGross: u.masterGross,
      masterBasic: u.masterBasic,
      masterHra: u.masterHra,
      masterOthers: u.masterOthers,
      pfApplicable: u.pfApplicable,
      esiApplicable: u.esiApplicable,
      payroll: rec ?? null,
    }
  })

  res.json(paginate(rows, total, pagination))
})

// ─── Calculation ─────────────────────────────────────────────────────────────

/** Preview without persisting. Used by the detail page's breakdown view. */
router.get('/calculate/:userId', async (req: AuthRequest, res) => {
  const userId = req.params.userId as string
  if (userId !== req.user!.id && !(await canViewOthers(req))) {
    return res.status(403).json({ error: 'Not allowed to view this payroll' })
  }
  const month = parseInt((req.query.month as string) ?? '', 10)
  const year = parseInt((req.query.year as string) ?? '', 10)
  if (!month || !year) return res.status(400).json({ error: 'month and year are required' })

  try {
    const calc = await calculatePayroll(userId, month, year)
    return res.json(calc)
  } catch (err) {
    return handleError(err, res)
  }
})

router.post('/run', requirePermission('salary', 'generate'), async (req: AuthRequest, res) => {
  const { userId, month, year, ...options } = req.body as Record<string, unknown>
  const m = Number(month)
  const y = Number(year)
  if (!m || !y) return res.status(400).json({ error: 'month and year are required' })

  try {
    if (userId) {
      const record = await runForEmployee(String(userId), m, y, req.user!.id, options)
      return res.json(record)
    }
    const results = await runForAll(m, y, req.user!.id)
    return res.json({
      total: results.length,
      calculated: results.filter((r) => r.status === 'ok').length,
      skipped: results.filter((r) => r.status === 'skipped'),
    })
  } catch (err) {
    return handleError(err, res)
  }
})

// ─── Periods ─────────────────────────────────────────────────────────────────

router.get('/periods', requirePermission('salary', 'read_all'), async (_req: AuthRequest, res) => {
  const periods = await prisma.payrollPeriod.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: { _count: { select: { records: true } } },
  })
  res.json(periods)
})

router.get('/periods/:month/:year', requirePermission('salary', 'read_all'), async (req: AuthRequest, res) => {
  const month = parseInt(req.params.month as string, 10)
  const year = parseInt(req.params.year as string, 10)
  const period = await prisma.payrollPeriod.findUnique({
    where: { month_year: { month, year } },
    include: {
      records: {
        where: { isCurrent: true },
        include: { user: { select: { id: true, name: true, employeeCode: true, email: true } } },
      },
    },
  })
  if (!period) return res.status(404).json({ error: 'Payroll period not found' })
  return res.json(period)
})

router.post('/periods', requirePermission('salary', 'generate'), async (req: AuthRequest, res) => {
  const { month, year } = req.body as { month: number; year: number }
  if (!month || !year) return res.status(400).json({ error: 'month and year are required' })
  const period = await ensurePeriod(Number(month), Number(year), req.user!.id)
  return res.json(period)
})

router.patch('/periods/:month/:year/approve', requirePermission('salary', 'approve'), async (req: AuthRequest, res) => {
  try {
    const period = await approvePeriod(
      parseInt(req.params.month as string, 10),
      parseInt(req.params.year as string, 10),
      req.user!.id
    )
    return res.json(period)
  } catch (err) {
    return handleError(err, res)
  }
})

router.patch('/periods/:month/:year/reopen', requirePermission('salary', 'approve'), async (req: AuthRequest, res) => {
  try {
    const period = await reopenPeriod(
      parseInt(req.params.month as string, 10),
      parseInt(req.params.year as string, 10),
      req.user!.id
    )
    return res.json(period)
  } catch (err) {
    return handleError(err, res)
  }
})

router.patch('/periods/:month/:year/paid', requirePermission('salary', 'mark_paid'), async (req: AuthRequest, res) => {
  try {
    const period = await markPeriodPaid(
      parseInt(req.params.month as string, 10),
      parseInt(req.params.year as string, 10)
    )
    return res.json(period)
  } catch (err) {
    return handleError(err, res)
  }
})

/** Full version history for one employee - shows what each approval contained. */
router.get('/history/:userId', async (req: AuthRequest, res) => {
  const userId = req.params.userId as string
  if (userId !== req.user!.id && !(await canViewOthers(req))) {
    return res.status(403).json({ error: 'Not allowed to view this payroll' })
  }
  const records = await prisma.payrollRecord.findMany({
    where: { userId },
    include: { period: true, adjustments: true },
    orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }, { version: 'desc' }],
  })
  return res.json(records)
})

// ─── Adjustments ─────────────────────────────────────────────────────────────

/**
 * Manual corrections are explicit rows, never in-place edits of a calculated
 * column. They only affect net pay once approved.
 */
router.post('/adjustments', requirePermission('salary', 'generate'), async (req: AuthRequest, res) => {
  const { userId, month, year, amount, type, reason, payrollRecordId } = req.body as Record<string, unknown>
  if (!userId || !month || !year || amount === undefined || !reason) {
    return res.status(400).json({ error: 'userId, month, year, amount and reason are required' })
  }
  if (String(reason).trim().length < 3) {
    return res.status(400).json({ error: 'A meaningful reason is required for a payroll adjustment' })
  }

  const adjustment = await prisma.payrollAdjustment.create({
    data: {
      userId: String(userId),
      month: Number(month),
      year: Number(year),
      amount: Number(amount),
      type: type ? String(type) : 'other',
      reason: String(reason),
      createdById: req.user!.id,
      payrollRecordId: payrollRecordId ? String(payrollRecordId) : null,
    },
  })
  return res.json(adjustment)
})

router.patch('/adjustments/:id/approve', requirePermission('salary', 'approve'), async (req: AuthRequest, res) => {
  const adjustment = await prisma.payrollAdjustment.update({
    where: { id: req.params.id as string },
    data: { approvedById: req.user!.id, approvedAt: new Date() },
  })
  return res.json(adjustment)
})

router.get('/adjustments/:userId', async (req: AuthRequest, res) => {
  const userId = req.params.userId as string
  if (userId !== req.user!.id && !(await canViewOthers(req))) {
    return res.status(403).json({ error: 'Not allowed to view these adjustments' })
  }
  const { month, year } = req.query as Record<string, string>
  const adjustments = await prisma.payrollAdjustment.findMany({
    where: {
      userId,
      ...(month ? { month: parseInt(month, 10) } : {}),
      ...(year ? { year: parseInt(year, 10) } : {}),
    },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return res.json(adjustments)
})

// ─── Salary slip from the approved snapshot ──────────────────────────────────

/**
 * Renders the slip straight from the stored PayrollRecord, so the printed
 * figures are exactly the approved ones rather than a recalculation.
 */
router.get('/records/:id/payslip', async (req: AuthRequest, res) => {
  const record = await prisma.payrollRecord.findUnique({
    where: { id: req.params.id as string },
    select: { userId: true, period: { select: { status: true } } },
  })
  if (!record) return res.status(404).json({ error: 'Payroll record not found' })

  if (record.userId !== req.user!.id && !(await canViewOthers(req))) {
    return res.status(403).json({ error: 'Not allowed to download this payslip' })
  }
  // A draft run is still being corrected; releasing a slip from it would hand
  // the employee a figure that may still change.
  if (record.period.status === 'Draft' || record.period.status === 'Reopened') {
    return res.status(409).json({ error: 'This payroll period is not approved yet' })
  }

  const slip = await generatePayrollPayslipPdf(req.params.id as string)
  if (!slip) return res.status(404).json({ error: 'Payroll record not found' })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${slip.filename}"`)
  return res.send(slip.buffer)
})

// ─── Statutory configuration ─────────────────────────────────────────────────

router.get('/config', requirePermission('salary', 'read_all'), async (_req: AuthRequest, res) => {
  const [config, ptSlabs] = await Promise.all([
    prisma.payrollStatutoryConfig.findFirst({ where: { isActive: true }, orderBy: { effectiveFrom: 'desc' } }),
    prisma.professionalTaxSlab.findMany({ where: { isActive: true }, orderBy: { minAmount: 'asc' } }),
  ])
  res.json({ config, ptSlabs })
})

export default router
