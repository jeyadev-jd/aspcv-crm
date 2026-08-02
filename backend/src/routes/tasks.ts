import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission, resolvePermission } from '../middleware/permissions'
import { createNotification } from '../services/notify'

const router = createSafeRouter()
router.use(authenticate)

const INCLUDE = {
  assignee: { select: { id: true, name: true, role: true } },
  department: { select: { id: true, name: true } },
  assignees: { include: { user: { select: { id: true, name: true, role: true } } } },
  departments: { include: { department: { select: { id: true, name: true } } } },
}

// Normalises the two assignment shapes the client may send: a single
// assigneeId/departmentId (legacy) or assigneeIds/departmentIds arrays. The first
// entry of each array also lands on the scalar column so existing filters,
// scoping and notifications keep working unchanged.
function resolveAssignment(body: Record<string, any>) {
  const userIds: string[] = Array.isArray(body.assigneeIds)
    ? [...new Set(body.assigneeIds.filter(Boolean))] as string[]
    : body.assigneeId ? [body.assigneeId] : []
  const deptIds: string[] = Array.isArray(body.departmentIds)
    ? [...new Set(body.departmentIds.filter(Boolean))] as string[]
    : body.departmentId ? [body.departmentId] : []
  return { userIds, deptIds, primaryUserId: userIds[0] ?? null, primaryDeptId: deptIds[0] ?? null }
}

// List — filterable by assignee, entity (project/lead/deal/…), status, or "mine"
router.get('/', async (req: AuthRequest, res) => {
  const { assigneeId, entityType, entityId, status, mine, includeInactive } = req.query as Record<string, string>
  const where: any = {}
  if (includeInactive !== 'true') where.isActive = true
  // A task can now have several assignees, so "mine" has to look at the junction
  // table too, not just the primary owner column.
  if (mine === 'true') {
    where.OR = [{ assigneeId: req.user!.id }, { assignees: { some: { userId: req.user!.id } } }]
  }
  if (assigneeId) {
    where.OR = [{ assigneeId }, { assignees: { some: { userId: assigneeId } } }]
  }
  if (entityType) where.entityType = entityType
  if (entityId) where.entityId = entityId
  if (status) where.status = status
  const tasks = await prisma.task.findMany({ where, include: INCLUDE, orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }] })
  res.json(tasks)
})

router.post('/', requirePermission('task', 'create'), async (req: AuthRequest, res) => {
  const { title, description, status, entityType, entityId, startDate, dueDate } = req.body
  if (!title?.trim()) { res.status(400).json({ error: 'Title required' }); return }
  const { userIds, deptIds, primaryUserId, primaryDeptId } = resolveAssignment(req.body)

  const task = await prisma.task.create({
    data: {
      title, description: description ?? null,
      status: status ?? 'Pending',
      assigneeId: primaryUserId,
      departmentId: primaryDeptId,
      entityType: entityType || null,
      entityId: entityId || null,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      assignees: { create: userIds.map(userId => ({ userId })) },
      departments: { create: deptIds.map(departmentId => ({ departmentId })) },
    },
    include: INCLUDE,
  })

  // Notify everyone assigned, not just the primary owner
  const recipients = userIds.filter(id => id !== req.user!.id)
  if (recipients.length > 0) {
    await createNotification({
      userIds: recipients, type: 'task', severity: 'info',
      title: 'New task assigned',
      message: `You were assigned "${task.title}"${task.dueDate ? ` (due ${task.dueDate.toISOString().slice(0, 10)})` : ''}.`,
      entityType: 'Task', entityId: task.id,
    })
  }
  res.status(201).json(task)
})

router.put('/:id', requirePermission('task', 'edit'), async (req: AuthRequest, res) => {
  const { title, description, status, checked, assigneeId, departmentId, assigneeIds, departmentIds, entityType, entityId, startDate, dueDate } = req.body
  const touchesAssignees = assigneeIds !== undefined || assigneeId !== undefined
  const touchesDepartments = departmentIds !== undefined || departmentId !== undefined
  const { userIds, deptIds, primaryUserId, primaryDeptId } = resolveAssignment(req.body)

  // Only touch the rows that actually changed. A blanket delete-and-recreate
  // would reset every assignment's createdAt, making long-standing assignees
  // look like they were added today.
  const current = (touchesAssignees || touchesDepartments)
    ? await prisma.task.findUnique({
        where: { id: req.params.id as string },
        include: { assignees: { select: { userId: true } }, departments: { select: { departmentId: true } } },
      })
    : null
  const currentUserIds = current?.assignees.map(a => a.userId) ?? []
  const currentDeptIds = current?.departments.map(d => d.departmentId) ?? []

  const task = await prisma.task.update({
    where: { id: req.params.id as string },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(checked !== undefined && { checked }),
      ...(entityType !== undefined && { entityType: entityType || null }),
      ...(entityId !== undefined && { entityId: entityId || null }),
      ...(touchesAssignees && {
        assigneeId: primaryUserId,
        assignees: {
          deleteMany: { userId: { notIn: userIds.length ? userIds : ['__none__'] } },
          create: userIds.filter(id => !currentUserIds.includes(id)).map(userId => ({ userId })),
        },
      }),
      ...(touchesDepartments && {
        departmentId: primaryDeptId,
        departments: {
          deleteMany: { departmentId: { notIn: deptIds.length ? deptIds : ['__none__'] } },
          create: deptIds.filter(id => !currentDeptIds.includes(id)).map(id => ({ departmentId: id })),
        },
      }),
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
  const existing = await prisma.task.findUnique({
    where: { id: req.params.id as string },
    include: { assignees: { select: { userId: true } } },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  // Only someone the task is actually assigned to may submit it — otherwise any
  // authenticated user could submit work against anyone else's task. Users who
  // can edit tasks generally (coordinators, admins) may also submit on their behalf.
  const isAssigned =
    existing.assigneeId === req.user!.id ||
    existing.assignees.some(a => a.userId === req.user!.id)
  const canEditAny = await resolvePermission(req.user!.id, req.user!.roleName, 'task', 'edit')
  if (!isAssigned && !canEditAny) {
    res.status(403).json({ error: 'Only an assignee can submit this task' })
    return
  }
  const task = await prisma.task.update({
    where: { id: req.params.id as string },
    data: { submissionUrl: submissionUrl ?? null, submittedAt: new Date(), status: 'Submitted' },
    include: INCLUDE,
  })
  res.json(task)
})

// Mark done (creator/admin sign-off)
router.post('/:id/complete', requirePermission('task', 'edit'), async (req: AuthRequest, res) => {
  const existing = await prisma.task.findUnique({
    where: { id: req.params.id as string },
    include: { assignees: { select: { userId: true } } },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const task = await prisma.task.update({
    where: { id: req.params.id as string },
    data: { status: 'Done', checked: true, completedAt: new Date() },
    include: INCLUDE,
  })
  const recipients = [...new Set([
    ...(existing.assigneeId ? [existing.assigneeId] : []),
    ...existing.assignees.map(a => a.userId),
  ])].filter(id => id !== req.user!.id)
  if (recipients.length > 0) {
    await createNotification({
      userIds: recipients, type: 'task', severity: 'info',
      title: 'Task marked done',
      message: `Your task "${task.title}" was marked complete.`,
      entityType: 'Task', entityId: task.id,
    })
  }
  res.json(task)
})

router.delete('/:id', requirePermission('task', 'delete'), async (req, res) => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  await prisma.task.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).send()
})

export default router
