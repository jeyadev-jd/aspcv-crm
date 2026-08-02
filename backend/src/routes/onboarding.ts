import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { logAudit } from '../services/audit'

const router = createSafeRouter()
router.use(authenticate)

const ALLOWED_ROLES = ['SuperAdmin', 'HR', 'Manager']

function checkRole(req: AuthRequest): boolean {
  return ALLOWED_ROLES.includes(req.user?.roleName || '')
}

// ==================== ONBOARDING ====================

// 1. GET /checklists — list all active checklists
router.get('/checklists', async (req: AuthRequest, res) => {
  if (!checkRole(req)) return res.status(403).json({ error: 'Access denied' })
  const items = await prisma.onboardingChecklist.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  res.json(items)
})

// 2. POST /checklists — create checklist item (HR/Admin only)
router.post('/checklists', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Only HR/Admin can create checklists' })
  }
  const { name, description, category, isRequired, sortOrder } = req.body
  if (!name || !category) {
    return res.status(400).json({ error: 'name and category are required' })
  }

  const item = await prisma.onboardingChecklist.create({
    data: {
      name,
      description: description || null,
      category,
      isRequired: isRequired ?? true,
      sortOrder: sortOrder ?? 0,
      isActive: true,
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'OnboardingChecklist',
    entityId: item.id, newValue: { name, category },
  })

  res.status(201).json(item)
})

// 3. GET /tasks/:userId — get all onboarding tasks for a user
router.get('/tasks/:userId', async (req: AuthRequest, res) => {
  if (!checkRole(req)) return res.status(403).json({ error: 'Access denied' })
  const tasks = await prisma.onboardingTask.findMany({
    where: { userId: req.params.userId as string },
    include: { checklist: true },
    orderBy: { checklist: { sortOrder: 'asc' } },
  })
  res.json(tasks)
})

// 4. POST /tasks/initialize/:userId — create tasks for each active checklist item
router.post('/tasks/initialize/:userId', async (req: AuthRequest, res) => {
  if (!checkRole(req)) return res.status(403).json({ error: 'Access denied' })
  const userId = req.params.userId as string

  const checklists = await prisma.onboardingChecklist.findMany({ where: { isActive: true } })
  const existing = await prisma.onboardingTask.findMany({
    where: { userId },
    select: { checklistId: true },
  })
  const existingIds = new Set(existing.map(e => e.checklistId))

  const toCreate = checklists.filter(c => !existingIds.has(c.id))
  if (toCreate.length === 0) {
    return res.json({ message: 'All tasks already initialized', created: 0 })
  }

  await prisma.onboardingTask.createMany({
    data: toCreate.map(c => ({
      userId,
      checklistId: c.id,
      status: 'NotStarted' as const,
    })),
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'OnboardingTask',
    entityId: userId, newValue: { initialized: toCreate.length },
  })

  res.status(201).json({ message: 'Tasks initialized', created: toCreate.length })
})

// 5. PATCH /tasks/:id — update task status
router.patch('/tasks/:id', async (req: AuthRequest, res) => {
  if (!checkRole(req)) return res.status(403).json({ error: 'Access denied' })
  const { status, remarks, documentUrl } = req.body

  const data: any = {}
  if (status) data.status = status
  if (remarks !== undefined) data.remarks = remarks
  if (documentUrl !== undefined) data.documentUrl = documentUrl

  if (status === 'Completed') {
    data.completedAt = new Date()
    data.completedBy = req.user!.id
  }

  const task = await prisma.onboardingTask.update({
    where: { id: req.params.id as string },
    data,
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'update', module: 'OnboardingTask',
    entityId: task.id, newValue: { status },
  })

  res.json(task)
})

// 6. GET /documents/:userId — list document verifications for user
router.get('/documents/:userId', async (req: AuthRequest, res) => {
  if (!checkRole(req)) return res.status(403).json({ error: 'Access denied' })
  const docs = await prisma.documentVerification.findMany({
    where: { userId: req.params.userId as string },
  })
  res.json(docs)
})

// 7. POST /documents — create/upsert document verification
router.post('/documents', async (req: AuthRequest, res) => {
  if (!checkRole(req)) return res.status(403).json({ error: 'Access denied' })
  const { userId, documentType, documentNo, documentUrl, remarks } = req.body
  if (!userId || !documentType) {
    return res.status(400).json({ error: 'userId and documentType are required' })
  }

  const doc = await prisma.documentVerification.upsert({
    where: { userId_documentType: { userId, documentType } },
    update: { documentNo, documentUrl, remarks },
    create: {
      userId,
      documentType,
      documentNo: documentNo || null,
      documentUrl: documentUrl || null,
      isVerified: false,
      remarks: remarks || null,
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'DocumentVerification',
    entityId: doc.id, newValue: { userId, documentType },
  })

  res.status(201).json(doc)
})

// 8. PATCH /documents/:id/verify — mark verified
router.patch('/documents/:id/verify', async (req: AuthRequest, res) => {
  if (!checkRole(req)) return res.status(403).json({ error: 'Access denied' })

  const doc = await prisma.documentVerification.update({
    where: { id: req.params.id as string },
    data: {
      isVerified: true,
      verifiedById: req.user!.id,
      verifiedAt: new Date(),
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'verify', module: 'DocumentVerification',
    entityId: doc.id, newValue: { documentType: doc.documentType },
  })

  res.json(doc)
})

// ==================== OFFBOARDING ====================

// 9. GET /exit-interview/:userId — get exit interview
router.get('/exit-interview/:userId', async (req: AuthRequest, res) => {
  if (!checkRole(req)) return res.status(403).json({ error: 'Access denied' })
  const interview = await prisma.exitInterview.findUnique({
    where: { userId: req.params.userId as string },
  })
  if (!interview) return res.status(404).json({ error: 'Exit interview not found' })
  res.json(interview)
})

// 10. POST /exit-interview — create/upsert exit interview
router.post('/exit-interview', async (req: AuthRequest, res) => {
  if (!checkRole(req)) return res.status(403).json({ error: 'Access denied' })
  const { userId, interviewDate, conductedById, reasonForLeaving, feedback, wouldRecommend, wouldRejoin, suggestions } = req.body
  if (!userId || !reasonForLeaving) {
    return res.status(400).json({ error: 'userId and reasonForLeaving are required' })
  }

  const interview = await prisma.exitInterview.upsert({
    where: { userId },
    update: {
      interviewDate: interviewDate ? new Date(interviewDate) : undefined,
      conductedById: conductedById || undefined,
      reasonForLeaving,
      feedback: feedback || null,
      wouldRecommend: wouldRecommend ?? null,
      wouldRejoin: wouldRejoin ?? null,
      suggestions: suggestions || null,
    },
    create: {
      userId,
      interviewDate: interviewDate ? new Date(interviewDate) : new Date(),
      conductedById: conductedById || req.user!.id,
      reasonForLeaving,
      feedback: feedback || null,
      wouldRecommend: wouldRecommend ?? null,
      wouldRejoin: wouldRejoin ?? null,
      suggestions: suggestions || null,
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'ExitInterview',
    entityId: interview.id, newValue: { userId, reasonForLeaving },
  })

  res.status(201).json(interview)
})

// 11. GET /clearance-items — list all active clearance items
router.get('/clearance-items', async (req: AuthRequest, res) => {
  if (!checkRole(req)) return res.status(403).json({ error: 'Access denied' })
  const items = await prisma.clearanceItem.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  res.json(items)
})

// 12. POST /clearance-items — create clearance item (HR/Admin only)
router.post('/clearance-items', async (req: AuthRequest, res) => {
  if (!['SuperAdmin', 'HR'].includes(req.user?.roleName || '')) {
    return res.status(403).json({ error: 'Only HR/Admin can create clearance items' })
  }
  const { name, department, isRequired, sortOrder } = req.body
  if (!name || !department) {
    return res.status(400).json({ error: 'name and department are required' })
  }

  const item = await prisma.clearanceItem.create({
    data: {
      name,
      department,
      isRequired: isRequired ?? true,
      sortOrder: sortOrder ?? 0,
      isActive: true,
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'ClearanceItem',
    entityId: item.id, newValue: { name, department },
  })

  res.status(201).json(item)
})

// 13. GET /clearance/:userId — get all clearance status for a user
router.get('/clearance/:userId', async (req: AuthRequest, res) => {
  if (!checkRole(req)) return res.status(403).json({ error: 'Access denied' })
  const clearances = await prisma.employeeClearance.findMany({
    where: { userId: req.params.userId as string },
    include: { clearanceItem: true },
    orderBy: { clearanceItem: { sortOrder: 'asc' } },
  })
  res.json(clearances)
})

// 14. POST /clearance/initialize/:userId — create clearance for each active item
router.post('/clearance/initialize/:userId', async (req: AuthRequest, res) => {
  if (!checkRole(req)) return res.status(403).json({ error: 'Access denied' })
  const userId = req.params.userId as string

  const items = await prisma.clearanceItem.findMany({ where: { isActive: true } })
  const existing = await prisma.employeeClearance.findMany({
    where: { userId },
    select: { clearanceItemId: true },
  })
  const existingIds = new Set(existing.map(e => e.clearanceItemId))

  const toCreate = items.filter(i => !existingIds.has(i.id))
  if (toCreate.length === 0) {
    return res.json({ message: 'All clearances already initialized', created: 0 })
  }

  await prisma.employeeClearance.createMany({
    data: toCreate.map(i => ({
      userId,
      clearanceItemId: i.id,
      status: 'Pending' as const,
    })),
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'EmployeeClearance',
    entityId: userId, newValue: { initialized: toCreate.length },
  })

  res.status(201).json({ message: 'Clearances initialized', created: toCreate.length })
})

// 15. PATCH /clearance/:id — update clearance status
router.patch('/clearance/:id', async (req: AuthRequest, res) => {
  if (!checkRole(req)) return res.status(403).json({ error: 'Access denied' })
  const { status, remarks } = req.body

  const data: any = {}
  if (status) data.status = status
  if (remarks !== undefined) data.remarks = remarks

  if (status === 'Cleared' || status === 'Waived') {
    data.clearedById = req.user!.id
    data.clearedAt = new Date()
  }

  const clearance = await prisma.employeeClearance.update({
    where: { id: req.params.id as string },
    data,
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'update', module: 'EmployeeClearance',
    entityId: clearance.id, newValue: { status },
  })

  res.json(clearance)
})

// 16. GET /clearance-summary/:userId — summary of clearance status
router.get('/clearance-summary/:userId', async (req: AuthRequest, res) => {
  if (!checkRole(req)) return res.status(403).json({ error: 'Access denied' })
  const userId = req.params.userId as string

  const clearances = await prisma.employeeClearance.findMany({ where: { userId } })
  const total = clearances.length
  const cleared = clearances.filter(c => c.status === 'Cleared' || c.status === 'Waived').length
  const pending = clearances.filter(c => c.status === 'Pending').length

  res.json({ userId, total, cleared, pending, isFullyCleared: total > 0 && pending === 0 })
})

export default router
