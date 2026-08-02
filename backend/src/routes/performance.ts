import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { logAudit } from '../services/audit'

const router = createSafeRouter()
router.use(authenticate)

const ADMIN_ROLES = ['SuperAdmin', 'HR', 'Manager', 'BusinessHead']

function isAdmin(roleName?: string) {
  return ADMIN_ROLES.includes(roleName || '')
}

// ─── GOALS ──────────────────────────────────────────────────────────────────

// List goals
router.get('/goals', async (req: AuthRequest, res) => {
  const { userId } = req.query
  const where: any = {}
  if (isAdmin(req.user?.roleName) && userId) {
    where.userId = userId
  } else {
    where.userId = req.user!.id
  }

  const goals = await prisma.goal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  res.json(goals)
})

// Create goal
router.post('/goals', async (req: AuthRequest, res) => {
  const { title, description, category, weightage, targetValue, actualValue, unit, startDate, dueDate, status, progress, remarks, userId } = req.body
  if (!title || !category) {
    return res.status(400).json({ error: 'title and category are required' })
  }

  const assignUserId = isAdmin(req.user?.roleName) && userId ? userId : req.user!.id

  const goal = await prisma.goal.create({
    data: {
      userId: assignUserId,
      title,
      description: description || null,
      category,
      weightage: weightage ? parseFloat(weightage) : 0,
      targetValue: targetValue ? parseFloat(targetValue) : undefined,
      actualValue: actualValue ? parseFloat(actualValue) : undefined,
      unit: unit || null,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: status || 'Draft',
      progress: progress ? parseInt(progress) : 0,
      remarks: remarks || null,
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'Goal',
    entityId: goal.id, newValue: { title, category },
  })

  res.status(201).json(goal)
})

// Update goal
router.patch('/goals/:id', async (req: AuthRequest, res) => {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: req.params.id as string } })

  if (goal.userId !== req.user!.id && !isAdmin(req.user?.roleName)) {
    return res.status(403).json({ error: 'Access denied' })
  }

  const { title, description, category, weightage, targetValue, actualValue, unit, startDate, dueDate, status, progress, remarks } = req.body
  const data: any = {}
  if (title !== undefined) data.title = title
  if (description !== undefined) data.description = description
  if (category !== undefined) data.category = category
  if (weightage !== undefined) data.weightage = parseFloat(weightage)
  if (targetValue !== undefined) data.targetValue = parseFloat(targetValue)
  if (actualValue !== undefined) data.actualValue = parseFloat(actualValue)
  if (unit !== undefined) data.unit = unit
  if (startDate !== undefined) data.startDate = new Date(startDate)
  if (dueDate !== undefined) data.dueDate = new Date(dueDate)
  if (status !== undefined) data.status = status
  if (progress !== undefined) data.progress = parseInt(progress)
  if (remarks !== undefined) data.remarks = remarks

  const updated = await prisma.goal.update({ where: { id: goal.id }, data })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'update', module: 'Goal',
    entityId: goal.id, newValue: data,
  })

  res.json(updated)
})

// ─── KPIs ───────────────────────────────────────────────────────────────────

// List KPIs
router.get('/kpis', async (_req: AuthRequest, res) => {
  const kpis = await prisma.kPI.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })
  res.json(kpis)
})

// Create KPI (HR/Admin only)
router.post('/kpis', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Only HR/Admin can create KPIs' })
  }

  const { name, description, department, formula, target, unit, frequency, isActive } = req.body
  if (!name) {
    return res.status(400).json({ error: 'name is required' })
  }

  const kpi = await prisma.kPI.create({
    data: {
      name,
      description: description || null,
      department: department || null,
      formula: formula || null,
      target: target ? parseFloat(target) : null,
      unit: unit || null,
      frequency: frequency || 'Monthly',
      isActive: isActive !== undefined ? isActive : true,
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'KPI',
    entityId: kpi.id, newValue: { name, department },
  })

  res.status(201).json(kpi)
})

// ─── KPI SCORES ─────────────────────────────────────────────────────────────

// List KPI scores
router.get('/kpi-scores', async (req: AuthRequest, res) => {
  const { userId, period } = req.query
  const where: any = {}

  if (isAdmin(req.user?.roleName) && userId) {
    where.userId = userId
  } else if (!isAdmin(req.user?.roleName)) {
    where.userId = req.user!.id
  }
  if (period) where.period = period

  const scores = await prisma.kPIScore.findMany({
    where,
    include: { kpi: { select: { id: true, name: true, unit: true, target: true } } },
    orderBy: { scoredAt: 'desc' },
    take: 200,
  })
  res.json(scores)
})

// Create/upsert KPI score
router.post('/kpi-scores', async (req: AuthRequest, res) => {
  const { kpiId, userId, period, score, remarks } = req.body
  if (!kpiId || !period || score === undefined) {
    return res.status(400).json({ error: 'kpiId, period, and score are required' })
  }

  const assignUserId = isAdmin(req.user?.roleName) && userId ? userId : req.user!.id

  const record = await prisma.kPIScore.upsert({
    where: {
      kpiId_userId_period: { kpiId, userId: assignUserId, period },
    },
    update: {
      score: parseFloat(score),
      remarks: remarks || null,
      scoredAt: new Date(),
    },
    create: {
      kpiId,
      userId: assignUserId,
      period,
      score: parseFloat(score),
      remarks: remarks || null,
      scoredAt: new Date(),
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'upsert', module: 'KPIScore',
    entityId: record.id, newValue: { kpiId, period, score },
  })

  res.status(201).json(record)
})

// ─── APPRAISALS ─────────────────────────────────────────────────────────────

// List appraisals
router.get('/appraisals', async (req: AuthRequest, res) => {
  const { userId } = req.query
  const where: any = {}

  if (isAdmin(req.user?.roleName) && userId) {
    where.userId = userId
  } else if (!isAdmin(req.user?.roleName)) {
    where.userId = req.user!.id
  }

  const appraisals = await prisma.appraisal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  res.json(appraisals)
})

// Create appraisal
router.post('/appraisals', async (req: AuthRequest, res) => {
  const { userId, reviewerId, period, status, selfRating, selfComments } = req.body
  if (!period) {
    return res.status(400).json({ error: 'period is required' })
  }

  const assignUserId = isAdmin(req.user?.roleName) && userId ? userId : req.user!.id

  const appraisal = await prisma.appraisal.create({
    data: {
      userId: assignUserId,
      reviewerId: reviewerId || null,
      period,
      status: status || 'Draft',
      selfRating: selfRating ? parseFloat(selfRating) : null,
      selfComments: selfComments || null,
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'Appraisal',
    entityId: appraisal.id, newValue: { period, assignUserId },
  })

  res.status(201).json(appraisal)
})

// Update appraisal
router.patch('/appraisals/:id', async (req: AuthRequest, res) => {
  const appraisal = await prisma.appraisal.findUniqueOrThrow({ where: { id: req.params.id as string } })

  if (appraisal.userId !== req.user!.id && !isAdmin(req.user?.roleName)) {
    return res.status(403).json({ error: 'Access denied' })
  }

  const {
    status, selfRating, managerRating, finalRating,
    selfComments, managerComments, hrComments,
    strengths, areasOfImprovement,
    promotionRecommended, incrementRecommended, reviewerId,
  } = req.body

  const data: any = {}
  if (status !== undefined) data.status = status
  if (selfRating !== undefined) data.selfRating = parseFloat(selfRating)
  if (managerRating !== undefined) data.managerRating = parseFloat(managerRating)
  if (finalRating !== undefined) data.finalRating = parseFloat(finalRating)
  if (selfComments !== undefined) data.selfComments = selfComments
  if (managerComments !== undefined) data.managerComments = managerComments
  if (hrComments !== undefined) data.hrComments = hrComments
  if (strengths !== undefined) data.strengths = strengths
  if (areasOfImprovement !== undefined) data.areasOfImprovement = areasOfImprovement
  if (promotionRecommended !== undefined) data.promotionRecommended = promotionRecommended
  if (incrementRecommended !== undefined) data.incrementRecommended = incrementRecommended
  if (reviewerId !== undefined) data.reviewerId = reviewerId
  if (status === 'Completed') data.completedAt = new Date()

  const updated = await prisma.appraisal.update({ where: { id: appraisal.id }, data })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'update', module: 'Appraisal',
    entityId: appraisal.id, newValue: data,
  })

  res.json(updated)
})

// ─── PROMOTIONS ─────────────────────────────────────────────────────────────

// List promotions
router.get('/promotions', async (req: AuthRequest, res) => {
  const { userId } = req.query
  const where: any = {}

  if (isAdmin(req.user?.roleName) && userId) {
    where.userId = userId
  } else if (!isAdmin(req.user?.roleName)) {
    where.userId = req.user!.id
  }

  const promotions = await prisma.promotion.findMany({
    where,
    orderBy: { effectiveDate: 'desc' },
    take: 200,
  })
  res.json(promotions)
})

// Create promotion (HR/Admin only)
router.post('/promotions', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Only HR/Admin can create promotions' })
  }

  const { userId, fromDesignation, toDesignation, fromDepartment, toDepartment, effectiveDate, previousCTC, newCTC, reason } = req.body
  if (!userId || !toDesignation || !effectiveDate) {
    return res.status(400).json({ error: 'userId, toDesignation, and effectiveDate are required' })
  }

  const promotion = await prisma.promotion.create({
    data: {
      userId,
      fromDesignation: fromDesignation || null,
      toDesignation,
      fromDepartment: fromDepartment || null,
      toDepartment: toDepartment || null,
      effectiveDate: new Date(effectiveDate),
      previousCTC: previousCTC ? parseFloat(previousCTC) : null,
      newCTC: newCTC ? parseFloat(newCTC) : null,
      reason: reason || null,
      approvedById: req.user!.id,
      approvedAt: new Date(),
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'Promotion',
    entityId: promotion.id, newValue: { userId, toDesignation, effectiveDate },
  })

  res.status(201).json(promotion)
})

// ─── STATS ──────────────────────────────────────────────────────────────────

// Performance dashboard stats
router.get('/stats', async (req: AuthRequest, res) => {
  const isAdminUser = isAdmin(req.user?.roleName)
  const userFilter = isAdminUser ? {} : { userId: req.user!.id }

  const [goals, appraisals, completedAppraisals] = await Promise.all([
    prisma.goal.findMany({ where: { ...userFilter, status: { in: ['Active', 'Completed'] } }, select: { status: true, progress: true } }),
    prisma.appraisal.findMany({ where: userFilter, select: { status: true, finalRating: true, managerRating: true } }),
    prisma.appraisal.findMany({ where: { ...userFilter, status: 'Completed', finalRating: { not: null } }, select: { finalRating: true } }),
  ])

  const totalGoals = goals.length
  const completedGoals = goals.filter(g => g.status === 'Completed').length
  const avgProgress = totalGoals > 0 ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / totalGoals) : 0
  const goalsCompletionPct = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0

  const activeAppraisals = appraisals.filter(a => a.status !== 'Completed').length

  const ratings = completedAppraisals.map(a => a.finalRating!).filter(r => r !== null)
  const avgRating = ratings.length > 0 ? parseFloat((ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(2)) : null

  res.json({
    totalGoals,
    completedGoals,
    goalsCompletionPct,
    avgProgress,
    activeAppraisals: activeAppraisals,
    totalAppraisals: appraisals.length,
    avgFinalRating: avgRating,
  })
})

export default router
