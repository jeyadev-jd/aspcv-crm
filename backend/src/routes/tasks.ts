import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { createNotification } from '../services/notify'

const router = createSafeRouter()
router.use(authenticate)

const INCLUDE = {
  assignee: { select: { id: true, name: true, role: true } },
  department: { select: { id: true, name: true } },
}

// List — filterable by assignee, entity (project/lead/deal/…), status, or "mine"
router.get('/', async (req: AuthRequest, res) => {
  const { assigneeId, entityType, entityId, status, mine } = req.query as Record<string, string>
  const where: any = {}
  if (mine === 'true') where.assigneeId = req.user!.id
  if (assigneeId) where.assigneeId = assigneeId
  if (entityType) where.entityType = entityType
  if (entityId) where.entityId = entityId
  if (status) where.status = status
  const tasks = await prisma.task.findMany({ where, include: INCLUDE, orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }] })
  res.json(tasks)
})

router.post('/', requirePermission('task', 'create'), async (req: AuthRequest, res) => {
  const { title, description, status, assigneeId, departmentId, entityType, entityId, startDate, dueDate } = req.body
  if (!title?.trim()) { res.status(400).json({ error: 'Title required' }); return }
  const task = await prisma.task.create({
    data: {
      title, description: description ?? null,
      status: status ?? 'Pending',
      assigneeId: assigneeId || null,
      departmentId: departmentId || null,
      entityType: entityType || null,
      entityId: entityId || null,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
    include: INCLUDE,
  })
  // Notify the assignee they have a new task
  if (task.assigneeId && task.assigneeId !== req.user!.id) {
    await createNotification({
      userIds: [task.assigneeId], type: 'task', severity: 'info',
      title: 'New task assigned',
      message: `You were assigned "${task.title}"${task.dueDate ? ` (due ${task.dueDate.toISOString().slice(0, 10)})` : ''}.`,
      entityType: 'Task', entityId: task.id,
    })
  }
  res.status(201).json(task)
})

router.put('/:id', requirePermission('task', 'edit'), async (req: AuthRequest, res) => {
  const { title, description, status, checked, assigneeId, departmentId, startDate, dueDate } = req.body
  const task = await prisma.task.update({
    where: { id: req.params.id as string },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(checked !== undefined && { checked }),
      ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
      ...(departmentId !== undefined && { departmentId: departmentId || null }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    },
    include: INCLUDE,
  })
  res.json(task)
})

// Assignee submits work with a URL → status Submitted
router.post('/:id/submit', async (req: AuthRequest, res) => {
  const { submissionUrl } = req.body as { submissionUrl?: string }
  const existing = await prisma.task.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const task = await prisma.task.update({
    where: { id: req.params.id as string },
    data: { submissionUrl: submissionUrl ?? null, submittedAt: new Date(), status: 'Submitted' },
    include: INCLUDE,
  })
  res.json(task)
})

// Mark done (creator/admin sign-off)
router.post('/:id/complete', requirePermission('task', 'edit'), async (req: AuthRequest, res) => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const task = await prisma.task.update({
    where: { id: req.params.id as string },
    data: { status: 'Done', checked: true, completedAt: new Date() },
    include: INCLUDE,
  })
  if (existing.assigneeId && existing.assigneeId !== req.user!.id) {
    await createNotification({
      userIds: [existing.assigneeId], type: 'task', severity: 'info',
      title: 'Task marked done',
      message: `Your task "${task.title}" was marked complete.`,
      entityType: 'Task', entityId: task.id,
    })
  }
  res.json(task)
})

router.delete('/:id', requirePermission('task', 'delete'), async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id as string } })
  res.status(204).send()
})

export default router
