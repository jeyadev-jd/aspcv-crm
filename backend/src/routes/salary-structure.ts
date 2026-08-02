import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { logAudit } from '../services/audit'
import { requireSuperAdminOrQueueApproval } from '../services/hrConfigApproval'

const router = createSafeRouter()
router.use(authenticate)

// Get salary components
router.get('/components', async (_req: AuthRequest, res) => {
  const components = await prisma.salaryComponent.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  res.json(components)
})

// Create/update component (admin)
router.post('/components', async (req: AuthRequest, res) => {
  const proceed = await requireSuperAdminOrQueueApproval(req, res, 'salary_component', 'upsert', req.body)
  if (!proceed) return
  const { code, name, type, calculationType, percentageOf, percentage, fixedAmount, isTaxable, isStatutory, sortOrder } = req.body
  if (!code || !name) return res.status(400).json({ error: 'code and name required' })

  const comp = await prisma.salaryComponent.upsert({
    where: { code },
    update: { name, type, calculationType, percentageOf, percentage, fixedAmount, isTaxable, isStatutory, sortOrder },
    create: { code, name, type, calculationType, percentageOf, percentage, fixedAmount, isTaxable, isStatutory, sortOrder },
  })
  res.json(comp)
})

router.delete('/components/:id', async (req: AuthRequest, res) => {
  const proceed = await requireSuperAdminOrQueueApproval(req, res, 'salary_component', 'delete', { id: req.params.id })
  if (!proceed) return
  await prisma.salaryComponent.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

// Calculate salary breakdown for a gross amount
router.post('/calculate', async (req: AuthRequest, res) => {
  const { grossSalary } = req.body
  if (!grossSalary) return res.status(400).json({ error: 'grossSalary required' })

  const components = await prisma.salaryComponent.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  const gross = parseFloat(grossSalary)
  const breakdown: Record<string, number> = {}
  let basic = 0, totalEarnings = 0, totalDeductions = 0, totalEmployer = 0

  // First pass: compute earnings
  for (const comp of components.filter(c => c.type === 'earning')) {
    let amount = 0
    if (comp.calculationType === 'percentage' && comp.percentageOf === 'gross') {
      amount = Math.round(gross * (comp.percentage || 0) / 100)
    } else if (comp.calculationType === 'percentage' && comp.percentageOf === 'basic') {
      amount = Math.round(basic * (comp.percentage || 0) / 100)
    } else if (comp.calculationType === 'fixed') {
      amount = comp.fixedAmount || 0
    } else if (comp.calculationType === 'remainder') {
      // Special Allowance = Gross - all other earnings
      amount = gross - totalEarnings
    }
    if (comp.code === 'BASIC') basic = amount
    breakdown[comp.code] = amount
    totalEarnings += amount
  }

  // Fix remainder (Special Allowance)
  const saComp = components.find(c => c.code === 'SA')
  if (saComp) {
    breakdown['SA'] = gross - (totalEarnings - (breakdown['SA'] || 0))
    if (breakdown['SA'] < 0) breakdown['SA'] = 0
  }

  // Second pass: compute deductions
  for (const comp of components.filter(c => c.type === 'deduction')) {
    let amount = 0
    if (comp.calculationType === 'percentage' && comp.percentageOf === 'basic') {
      amount = Math.round(basic * (comp.percentage || 0) / 100)
    } else if (comp.calculationType === 'percentage' && comp.percentageOf === 'gross') {
      amount = Math.round(gross * (comp.percentage || 0) / 100)
    } else if (comp.calculationType === 'fixed') {
      amount = comp.fixedAmount || 0
    } else if (comp.calculationType === 'slab') {
      // TDS slab calculation
      const annual = gross * 12
      let tax = 0
      if (annual > 1500000) tax = 140000 + (annual - 1500000) * 0.30
      else if (annual > 1200000) tax = 80000 + (annual - 1200000) * 0.20
      else if (annual > 1000000) tax = 50000 + (annual - 1000000) * 0.15
      else if (annual > 700000) tax = 20000 + (annual - 700000) * 0.10
      else if (annual > 300000) tax = (annual - 300000) * 0.05
      amount = Math.round(tax * 1.04 / 12)
    }

    // ESI only if gross <= 21000
    if (comp.code === 'ESI_EE' && gross > 21000) amount = 0

    breakdown[comp.code] = amount
    totalDeductions += amount
  }

  // Employer contributions
  for (const comp of components.filter(c => c.type === 'employer')) {
    let amount = 0
    if (comp.calculationType === 'percentage' && comp.percentageOf === 'basic') {
      amount = Math.round(basic * (comp.percentage || 0) / 100)
    } else if (comp.calculationType === 'percentage' && comp.percentageOf === 'gross') {
      amount = Math.round(gross * (comp.percentage || 0) / 100)
    }
    if (comp.code === 'ESI_ER' && gross > 21000) amount = 0
    breakdown[comp.code] = amount
    totalEmployer += amount
  }

  res.json({
    gross,
    basic,
    breakdown,
    totalEarnings: gross,
    totalDeductions,
    totalEmployerContribution: totalEmployer,
    netSalary: gross - totalDeductions,
    ctc: gross + totalEmployer,
  })
})

// Salary revision
router.post('/revision', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR', 'BusinessHead'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Not authorized' })
  }
  const { userId, newGross, effectiveDate, reason } = req.body
  if (!userId || !newGross || !effectiveDate) {
    return res.status(400).json({ error: 'userId, newGross, effectiveDate required' })
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const previousGross = (user.baseSalary || 0) + (user.hra || 0) + (user.allowances || 0)
  const newBasic = Math.round(newGross * 0.5)
  const newHra = Math.round(newBasic * 0.5)
  const newAllowances = newGross - newBasic - newHra
  const percentageIncrease = previousGross > 0 ? Math.round((newGross - previousGross) / previousGross * 10000) / 100 : 0

  // Calculate arrears
  const effDate = new Date(effectiveDate)
  const now = new Date()
  const arrearsMonths = Math.max(0, (now.getFullYear() - effDate.getFullYear()) * 12 + now.getMonth() - effDate.getMonth())
  const monthlyDiff = newGross - previousGross
  const arrearsAmount = Math.max(0, arrearsMonths * monthlyDiff)

  const revision = await prisma.salaryRevision.create({
    data: {
      userId,
      effectiveDate: effDate,
      previousGross,
      newGross,
      percentageIncrease,
      previousBasic: user.baseSalary || 0,
      newBasic,
      previousHra: user.hra || 0,
      newHra,
      reason: reason || null,
      approvedById: req.user!.id,
      approvedAt: new Date(),
      arrearsAmount,
      arrearsMonths,
    },
  })

  // Update user salary
  await prisma.user.update({
    where: { id: userId },
    data: { baseSalary: newBasic, hra: newHra, allowances: newAllowances },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'update', module: 'SalaryRevision',
    entityId: revision.id,
    oldValue: { gross: previousGross },
    newValue: { gross: newGross, increase: `${percentageIncrease}%`, arrears: arrearsAmount },
  })

  res.json(revision)
})

// Get revision history
router.get('/revisions/:userId', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR', 'BusinessHead'].includes(req.user?.roleName || '')) {
    if (req.user!.id !== req.params.userId) {
      return res.status(403).json({ error: 'Access denied' })
    }
  }
  const revisions = await prisma.salaryRevision.findMany({
    where: { userId: req.params.userId as string },
    orderBy: { effectiveDate: 'desc' },
  })
  res.json(revisions)
})

export default router
