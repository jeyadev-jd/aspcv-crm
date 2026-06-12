import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
router.use(authenticate)

function calcTDS(annualGross: number): number {
  // Basic Indian tax slabs (FY 2024-25 new regime)
  let tax = 0
  if (annualGross <= 300000) tax = 0
  else if (annualGross <= 700000) tax = (annualGross - 300000) * 0.05
  else if (annualGross <= 1000000) tax = 20000 + (annualGross - 700000) * 0.10
  else if (annualGross <= 1200000) tax = 50000 + (annualGross - 1000000) * 0.15
  else if (annualGross <= 1500000) tax = 80000 + (annualGross - 1200000) * 0.20
  else tax = 140000 + (annualGross - 1500000) * 0.30
  // 4% cess
  tax = tax * 1.04
  return Math.round(tax / 12)
}

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
  const daysAbsent = daysInMonth - daysPresent
  const lateDays = records.filter(r => r.minutesLate > 0).length

  // Penalty: >=3 late days = full day cut, ==2 late days = half day cut
  const fullDayCuts = lateDays >= 3 ? 1 : 0
  const halfDayCuts = lateDays === 2 ? 1 : 0

  const dailyRate = user.baseSalary / daysInMonth
  const lateDeduction = fullDayCuts * dailyRate + halfDayCuts * dailyRate * 0.5

  const hra = user.hra ?? 0
  const allowances = user.allowances ?? 0
  const grossSalary = user.baseSalary + hra + allowances

  const pfEmployee = user.pfApplicable ? Math.round(user.baseSalary * 0.12) : 0
  const pfEmployer = user.pfApplicable ? Math.round(user.baseSalary * 0.12) : 0
  const esiEmployee = (user.esiApplicable && grossSalary <= 21000) ? Math.round(grossSalary * 0.0075) : 0
  const esiEmployer = (user.esiApplicable && grossSalary <= 21000) ? Math.round(grossSalary * 0.0325) : 0
  const tds = calcTDS(grossSalary * 12)
  const netSalary = grossSalary - pfEmployee - esiEmployee - tds - lateDeduction

  const record = await prisma.salaryRecord.upsert({
    where: { userId_month_year: { userId, month, year } },
    update: { baseSalary: user.baseSalary, hra, allowances, grossSalary, pfEmployee, pfEmployer, esiEmployee, esiEmployer, tds, lateDeduction, netSalary, daysPresent, daysAbsent, lateDays, halfDayCuts, fullDayCuts, status: 'draft' },
    create: { userId, month, year, baseSalary: user.baseSalary, hra, allowances, grossSalary, pfEmployee, pfEmployer, esiEmployee, esiEmployer, tds, lateDeduction, netSalary, daysPresent, daysAbsent, lateDays, halfDayCuts, fullDayCuts },
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
  const { month, year, userId } = req.query as Record<string, string>
  const records = await prisma.salaryRecord.findMany({
    where: {
      ...(month && { month: parseInt(month) }),
      ...(year && { year: parseInt(year) }),
      ...(userId && { userId }),
    },
    include: { user: { select: { id: true, name: true, role: true, department: true } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })
  res.json(records)
})

router.patch('/:id/approve', requirePermission('salary', 'approve'), async (req: AuthRequest, res) => {
  const record = await prisma.salaryRecord.update({ where: { id: req.params.id as string }, data: { status: 'approved' } })
  res.json(record)
})

router.patch('/:id/paid', requirePermission('salary', 'mark_paid'), async (req: AuthRequest, res) => {
  const record = await prisma.salaryRecord.update({ where: { id: req.params.id as string }, data: { status: 'paid', paidAt: new Date() } })
  res.json(record)
})

export default router
