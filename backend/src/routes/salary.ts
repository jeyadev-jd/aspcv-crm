import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission, resolvePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { decryptIfPresent } from '../lib/encrypt'
import { notifyRoles } from '../services/notify'
import { emailPayslip, generatePayslipPdf } from '../services/payslip'

const router = createSafeRouter()
router.use(authenticate)

// Numeric columns HR may correct on a manual edit. Everything else on the row
// (attendance counts, ids, status) is off-limits to a crafted payload.
export const SALARY_EDIT_KEYS = [
  'baseSalary', 'hra', 'allowances', 'grossSalary',
  'pfEmployee', 'pfEmployer', 'esiEmployee', 'esiEmployer',
  'tds', 'lateDeduction', 'absentDeduction', 'otherDeduction',
] as const

/** Net = gross − employee deductions. Recomputed after any manual correction. */
export function recomputeNet(r: {
  grossSalary: number; pfEmployee: number; esiEmployee: number; tds: number;
  lateDeduction: number; absentDeduction: number; otherDeduction: number
}): number {
  return Math.max(0, r.grossSalary - r.pfEmployee - r.esiEmployee - r.tds - r.lateDeduction - r.absentDeduction - r.otherDeduction)
}

// TDS moved to services/payroll/tds.ts so the payroll engine and this legacy
// route share one implementation. Re-exported to keep existing importers working.
import { calcTDS } from '../services/payroll/tds'
export { calcTDS, STANDARD_DEDUCTION, REBATE_87A_LIMIT, REBATE_87A_MAX } from '../services/payroll/tds'

// Generate salary for a user+month
router.post('/generate', requirePermission('salary', 'generate'), async (req: AuthRequest, res) => {
  const { userId, month, year } = req.body as { userId: string; month: number; year: number }
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !user.baseSalary) { res.status(400).json({ error: 'User or salary not configured' }); return }

  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  const daysInMonth = new Date(year, month, 0).getDate()

  const records = await prisma.attendanceRecord.findMany({
    where: { userId, date: { gte: start, lt: end } },
  })

  const daysPresent = records.filter(r => ['present', 'late', 'half_day'].includes(r.status)).length
  const leaveDays = records.filter(r => r.status === 'leave').length
  const daysAbsent = Math.max(0, daysInMonth - daysPresent - leaveDays)
  const lateDays = records.filter(r => r.minutesLate > 0).length

  // Late-to-LOP engine: fetch rules from DB, find matching rule
  const lopRules = await prisma.lateLopRule.findMany({
    where: { isActive: true },
    orderBy: { lateCount: 'desc' },
  })
  let lopDays = 0
  for (const rule of lopRules) {
    if (lateDays >= rule.lateCount) {
      lopDays = rule.lopDays
      break
    }
  }
  const fullDayCuts = Math.floor(lopDays)
  const halfDayCuts = lopDays % 1 >= 0.5 ? 1 : 0

  const dailyRate = user.baseSalary / daysInMonth
  const lateDeduction = lopDays * dailyRate

  // Loss of pay for unapproved absences only. Approved leave and approved
  // half-days are paid — half days go through the leave-approval flow, so
  // deducting for them here would double-penalise an already-sanctioned day.
  const absentDeduction = daysAbsent * dailyRate

  const hra = user.hra ?? 0
  const allowances = user.allowances ?? 0
  const grossSalary = user.baseSalary + hra + allowances

  const pfEmployee = user.pfApplicable ? Math.round(user.baseSalary * 0.12) : 0
  const pfEmployer = user.pfApplicable ? Math.round(user.baseSalary * 0.12) : 0
  const esiEmployee = (user.esiApplicable && grossSalary <= 21000) ? Math.round(grossSalary * 0.0075) : 0
  const esiEmployer = (user.esiApplicable && grossSalary <= 21000) ? Math.round(grossSalary * 0.0325) : 0
  const tds = calcTDS(grossSalary * 12)
  const netSalary = Math.max(0, grossSalary - pfEmployee - esiEmployee - tds - lateDeduction - absentDeduction)

  const record = await prisma.salaryRecord.upsert({
    where: { userId_month_year: { userId, month, year } },
    update: { baseSalary: user.baseSalary, hra, allowances, grossSalary, pfEmployee, pfEmployer, esiEmployee, esiEmployer, tds, lateDeduction, absentDeduction, netSalary, daysPresent, daysAbsent, lateDays, halfDayCuts, fullDayCuts, status: 'draft' },
    create: { userId, month, year, baseSalary: user.baseSalary, hra, allowances, grossSalary, pfEmployee, pfEmployer, esiEmployee, esiEmployer, tds, lateDeduction, absentDeduction, netSalary, daysPresent, daysAbsent, lateDays, halfDayCuts, fullDayCuts },
  })
  res.json(record)
})

// My salary records
router.get('/my', requirePermission('salary', 'read_own'), async (req: AuthRequest, res) => {
  const records = await prisma.salaryRecord.findMany({
    where: { userId: req.user!.id },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })
  res.json(records)
})

// All salary records (HR/Admin)
router.get('/all', requirePermission('salary', 'read_all'), async (req: AuthRequest, res) => {
  const { month, year, userId, all } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>)
  const where = {
    ...(month && { month: parseInt(month) }),
    ...(year && { year: parseInt(year) }),
    ...(userId && { userId }),
  }
  // `all=true` bypasses MAX_PAGE_SIZE: HR reports aggregate a whole month of
  // payroll and a truncated list silently under-reports the company totals.
  const [records, total] = await Promise.all([
    prisma.salaryRecord.findMany({
      where,
      include: { user: { select: { id: true, name: true, role: true, department: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      ...(all === 'true' ? {} : { skip: pagination.skip, take: pagination.take }),
    }),
    prisma.salaryRecord.count({ where }),
  ])
  res.json(paginate(records, total, pagination))
})

// NEFT export: RBI standard format for bulk salary transfers
router.get('/neft-export', requirePermission('salary', 'approve'), async (req: AuthRequest, res) => {
  const { month, year } = req.query as Record<string, string>
  if (!month || !year) { res.status(400).json({ error: 'month and year required' }); return }

  const records = await prisma.salaryRecord.findMany({
    where: { month: parseInt(month), year: parseInt(year), status: 'approved' },
    include: {
      user: { select: { id: true, name: true, bankAccount: true, ifsc: true, bankName: true, pan: true } },
    },
  })

  if (records.length === 0) { res.status(404).json({ error: 'No approved salary records for this month/year' }); return }

  // RBI IFT/NEFT bulk upload CSV format:
  // TransactionType, BeneficiaryName, BeneficiaryAccountNo, BeneficiaryIFSC, Amount, Remarks
  const lines: string[] = [
    'TransactionType,BeneficiaryName,BeneficiaryAccountNo,BeneficiaryIFSC,Amount,Remarks',
  ]

  for (const rec of records) {
    const bankAccount = decryptIfPresent(rec.user.bankAccount)
    const ifsc = decryptIfPresent(rec.user.ifsc)
    if (!bankAccount || !ifsc) continue // skip employees without bank details
    const name = rec.user.name.replace(/,/g, ' ')
    const amount = Math.round(rec.netSalary).toFixed(2)
    const remarks = `SAL/${year}/${month.padStart(2, '0')}/${rec.user.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 10).toUpperCase()}`
    lines.push(`NEFT,"${name}","${bankAccount}","${ifsc}",${amount},"${remarks}"`)
  }

  const totalAmount = records
    .filter(r => decryptIfPresent(r.user.bankAccount))
    .reduce((s, r) => s + Math.round(r.netSalary), 0)

  const csv = lines.join('\r\n')
  const filename = `NEFT_Salary_${year}_${month.padStart(2, '0')}.csv`

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('X-Total-Records', String(lines.length - 1))
  res.setHeader('X-Total-Amount', String(totalAmount))
  res.send(csv)
})

// Manual correction by HR when the auto-calculation is wrong. Does NOT write the
// record — raises an ApprovalRequest an admin signs off on, then the approve
// handler applies the whitelisted fields and recomputes net. Record is parked in
// 'pending' meanwhile so it can't be approved/paid through the normal flow.
router.patch('/:id/manual-edit', requirePermission('salary', 'generate'), async (req: AuthRequest, res) => {
  const record = await prisma.salaryRecord.findUnique({
    where: { id: req.params.id as string },
    include: { user: { select: { name: true } } },
  })
  if (!record) { res.status(404).json({ error: 'Salary record not found' }); return }
  if (record.status === 'paid') { res.status(400).json({ error: 'Paid salary cannot be edited' }); return }

  const body = req.body as Record<string, unknown> & { reason?: string }
  const fields: Record<string, number> = {}
  for (const k of SALARY_EDIT_KEYS) {
    if (body[k] !== undefined && body[k] !== null && !Number.isNaN(Number(body[k]))) {
      fields[k] = Number(body[k])
    }
  }
  if (Object.keys(fields).length === 0) { res.status(400).json({ error: 'No editable fields provided' }); return }

  const approval = await prisma.approvalRequest.create({
    data: {
      entityType: 'salary_record',
      entityId: record.id,
      action: 'edit',
      requestedById: req.user!.id,
      status: 'pending',
      payload: { recordId: record.id, fields, prevStatus: record.status } as any,
      reason: body.reason ? String(body.reason) : `Manual payroll correction for ${record.user?.name ?? 'employee'}`,
    },
  })
  await prisma.salaryRecord.update({ where: { id: record.id }, data: { status: 'pending' } })
  await notifyRoles(['SuperAdmin', 'BusinessHead'], {
    type: 'approval_request', severity: 'warning',
    title: 'Payroll correction approval needed',
    message: `${req.user!.roleName ?? 'HR'} corrected payroll for ${record.user?.name ?? 'an employee'} — approval required.`,
    entityType: 'ApprovalRequest', entityId: approval.id,
  })
  res.status(202).json({ status: 'approval_required', approvalId: approval.id })
})

router.patch('/:id/approve', requirePermission('salary', 'approve'), async (req: AuthRequest, res) => {
  const record = await prisma.salaryRecord.update({ where: { id: req.params.id as string }, data: { status: 'approved' } })
  // Approval is the trigger for delivery. emailPayslip never throws, so a mail
  // outage leaves the record approved and reports the failure to the caller
  // instead of rolling the approval back.
  const delivery = await emailPayslip(record.id)
  res.json({ ...record, emailSent: delivery.sent, emailError: delivery.error })
})

/**
 * Employees may download their own slip; anyone with read_all (HR/admin) may
 * download any. Streams the same PDF that gets emailed on approval.
 */
router.get('/:id/pdf', requirePermission('salary', 'read_own'), async (req: AuthRequest, res) => {
  const id = req.params.id as string
  const record = await prisma.salaryRecord.findUnique({ where: { id }, select: { userId: true } })
  if (!record) return res.status(404).json({ error: 'Salary record not found' })

  if (record.userId !== req.user!.id) {
    const canReadAll = await resolvePermission(req.user!.id, req.user!.roleName, 'salary', 'read_all')
    if (!canReadAll) return res.status(403).json({ error: 'Not allowed to download this payslip' })
  }

  const slip = await generatePayslipPdf(id)
  if (!slip) return res.status(404).json({ error: 'Salary record not found' })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${slip.filename}"`)
  return res.send(slip.buffer)
})

/** Manual resend, for when the approval-time email bounced or details changed. */
router.post('/:id/email', requirePermission('salary', 'approve'), async (req: AuthRequest, res) => {
  const delivery = await emailPayslip(req.params.id as string)
  if (!delivery.sent) return res.status(502).json({ error: delivery.error ?? 'Failed to send payslip' })
  res.json({ sent: true })
})

router.patch('/:id/paid', requirePermission('salary', 'mark_paid'), async (req: AuthRequest, res) => {
  const record = await prisma.salaryRecord.update({ where: { id: req.params.id as string }, data: { status: 'paid', paidAt: new Date() } })
  res.json(record)
})

export default router
