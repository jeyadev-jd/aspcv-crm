import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { logAudit } from '../services/audit'

const router = createSafeRouter()
router.use(authenticate)

// Get F&F for employee
router.get('/:userId', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR', 'Accountant'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Access denied' })
  }
  const fnf = await prisma.fnFSettlement.findUnique({
    where: { userId: req.params.userId as string },
    include: { user: { select: { id: true, name: true, joiningDate: true, baseSalary: true, department: true } } },
  })
  res.json(fnf || null)
})

// Initiate F&F
router.post('/initiate', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Only HR/Admin can initiate F&F' })
  }
  const { userId, exitDate, lastWorkingDate } = req.body
  if (!userId || !exitDate || !lastWorkingDate) {
    return res.status(400).json({ error: 'userId, exitDate, lastWorkingDate required' })
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const joiningDate = user.joiningDate || new Date()
  const yearsOfService = (new Date(exitDate).getTime() - joiningDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)

  // Calculate leave encashment
  const year = new Date().getFullYear()
  const balances = await prisma.leaveBalance.findMany({
    where: { userId, year },
    include: { leaveType: true },
  })
  const encashableBalance = balances
    .filter(b => b.leaveType.isEncashable && b.balance > 0)
    .reduce((sum, b) => sum + Math.min(b.balance, b.leaveType.maxEncashment || b.balance), 0)
  const dailyRate = (user.baseSalary || 0) / 30
  const leaveEncashment = Math.round(encashableBalance * dailyRate)

  // Gratuity: 15 days salary per year if > 5 years
  const gratuity = yearsOfService >= 5 ? Math.round((user.baseSalary || 0) * 15 / 26 * yearsOfService) : 0

  // Notice pay
  const noticeDays = user.noticePeriodDays || 30
  const lwdDate = new Date(lastWorkingDate)
  const exitD = new Date(exitDate)
  const remainingNotice = Math.max(0, noticeDays - Math.ceil((lwdDate.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000)))
  const noticePay = Math.round(remainingNotice * dailyRate)

  // Pending salary (current month pro-rata)
  const daysWorked = lwdDate.getDate()
  const daysInMonth = new Date(lwdDate.getFullYear(), lwdDate.getMonth() + 1, 0).getDate()
  const pendingSalary = Math.round(((user.baseSalary || 0) + (user.hra || 0) + (user.allowances || 0)) * daysWorked / daysInMonth)

  const totalPayable = leaveEncashment + gratuity + pendingSalary
  const totalDeductions = noticePay
  const netSettlement = totalPayable - totalDeductions

  const fnf = await prisma.fnFSettlement.upsert({
    where: { userId },
    update: {
      exitDate: exitD, lastWorkingDate: lwdDate,
      leaveEncashment, gratuity, noticePay, pendingSalary,
      totalPayable, totalDeductions, netSettlement,
      status: 'InProgress',
    },
    create: {
      userId, exitDate: exitD, lastWorkingDate: lwdDate,
      leaveEncashment, gratuity, noticePay, pendingSalary,
      totalPayable, totalDeductions, netSettlement,
      status: 'InProgress',
    },
  })

  // Update user exit details
  await prisma.user.update({
    where: { id: userId },
    data: { exitDate: exitD, exitReason: req.body.exitReason || null },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'FnF',
    entityId: fnf.id, newValue: { employee: user.name, netSettlement },
  })

  res.json(fnf)
})

// Complete F&F
router.patch('/:id/complete', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Only HR/Admin' })
  }

  const fnf = await prisma.fnFSettlement.update({
    where: { id: req.params.id as string },
    data: {
      status: 'Completed',
      processedById: req.user!.id,
      processedAt: new Date(),
      ...(req.body.assetRecovery !== undefined && { assetRecovery: req.body.assetRecovery }),
      ...(req.body.bonusAmount !== undefined && { bonusAmount: req.body.bonusAmount }),
      ...(req.body.otherDeductions !== undefined && { otherDeductions: req.body.otherDeductions }),
      ...(req.body.remarks && { remarks: req.body.remarks }),
    },
  })

  // Deactivate employee
  await prisma.user.update({
    where: { id: fnf.userId },
    data: { isActive: false },
  })

  res.json(fnf)
})

// List all F&F settlements
router.get('/', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR', 'Accountant'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Access denied' })
  }
  const records = await prisma.fnFSettlement.findMany({
    include: { user: { select: { id: true, name: true, department: true, joiningDate: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(records)
})

export default router
