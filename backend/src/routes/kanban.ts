import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { appendEvent } from '../services/timeline'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const CARD_INCLUDE = {
  assignees: { include: { user: { select: { id: true, name: true, role: true } } } },
  labels: { include: { label: true } },
  checklist: { orderBy: { order: 'asc' as const } },
  createdBy: { select: { id: true, name: true } },
  project: { select: { id: true, title: true } },
  task: { select: { id: true, title: true } },
  company: { select: { id: true, name: true } },
  lead: { select: { id: true, title: true } },
  deal: { select: { id: true, title: true } },
  department: { select: { id: true, name: true } },
}

// ── Boards ────────────────────────────────────────────────────────────────────

router.get('/boards', requirePermission('kanban', 'read_all'), async (req, res) => {
  const { includeArchived } = req.query as Record<string, string>
  const boards = await prisma.kanbanBoard.findMany({
    where: includeArchived === 'true' ? {} : { isArchived: false },
    include: {
      department: { select: { id: true, name: true } },
      labels: true,
      columns: {
        where: { isArchived: false },
        orderBy: { order: 'asc' },
        include: { cards: { where: { isArchived: false }, orderBy: { order: 'asc' }, include: CARD_INCLUDE } },
      },
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  res.json(boards)
})

const boardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  boardType: z.enum(['Custom', 'ProjectBoard', 'SalesPipeline', 'PurchaseWorkflow', 'ManufacturingWorkflow', 'ServiceWorkflow', 'HRRecruitment']).optional(),
  departmentId: z.string().optional(),
})

router.post('/boards', requirePermission('kanban', 'create'), async (req: AuthRequest, res) => {
  const data = boardSchema.parse(req.body)
  const board = await prisma.kanbanBoard.create({
    data: {
      ...data,
      createdById: req.user!.id,
      columns: {
        create: [
          { title: 'To Do', color: '#5D78FF', order: 0 },
          { title: 'In Progress', color: '#FF9B52', order: 1 },
          { title: 'Done', color: '#2BC155', order: 2, isDoneColumn: true },
        ],
      },
    },
    include: { columns: { orderBy: { order: 'asc' }, include: { cards: true } } },
  })
  await appendEvent('KanbanBoard', board.id, 'CREATED', `Board "${board.name}" created`, req.user?.id)
  res.status(201).json(board)
})

router.patch('/boards/:id', requirePermission('kanban', 'edit'), async (req, res) => {
  const data = boardSchema.partial().parse(req.body)
  const board = await prisma.kanbanBoard.update({ where: { id: req.params.id as string }, data })
  res.json(board)
})

router.post('/boards/:id/archive', requirePermission('kanban', 'delete'), async (req, res) => {
  const board = await prisma.kanbanBoard.update({ where: { id: req.params.id as string }, data: { isArchived: true } })
  res.json(board)
})

// ── Columns ───────────────────────────────────────────────────────────────────

const columnSchema = z.object({
  boardId: z.string().min(1),
  title: z.string().min(1),
  color: z.string().optional(),
  order: z.number().optional(),
  wipLimit: z.number().nullable().optional(),
  isDoneColumn: z.boolean().optional(),
})

router.post('/columns', requirePermission('kanban', 'create'), async (req, res) => {
  const data = columnSchema.parse(req.body)
  if (data.order === undefined) {
    const count = await prisma.kanbanColumn.count({ where: { boardId: data.boardId } })
    data.order = count
  }
  const column = await prisma.kanbanColumn.create({ data })
  res.status(201).json(column)
})

router.patch('/columns/:id', requirePermission('kanban', 'edit'), async (req, res) => {
  const data = columnSchema.partial().omit({ boardId: true }).parse(req.body)
  const column = await prisma.kanbanColumn.update({ where: { id: req.params.id as string }, data })
  res.json(column)
})

router.delete('/columns/:id', requirePermission('kanban', 'delete'), async (req, res) => {
  const cardCount = await prisma.kanbanCard.count({ where: { columnId: req.params.id as string, isArchived: false } })
  if (cardCount > 0) { res.status(400).json({ error: `Column has ${cardCount} card(s) — move or delete them first` }); return }
  await prisma.kanbanColumn.delete({ where: { id: req.params.id as string } })
  res.status(204).send()
})

// ── Cards ─────────────────────────────────────────────────────────────────────

const cardSchema = z.object({
  columnId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['High', 'Medium', 'Low']).optional(),
  status: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  estimatedHours: z.number().nullable().optional(),
  actualHours: z.number().nullable().optional(),
  progress: z.number().optional(),
  total: z.number().optional(),
  color: z.string().optional(),
  order: z.number().optional(),
  projectId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  leadId: z.string().nullable().optional(),
  dealId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  labelIds: z.array(z.string()).optional(),
})

router.post('/cards', requirePermission('kanban', 'create'), async (req: AuthRequest, res) => {
  const { assigneeIds, labelIds, ...data } = cardSchema.parse(req.body)
  if (data.order === undefined) {
    const count = await prisma.kanbanCard.count({ where: { columnId: data.columnId, isArchived: false } })
    data.order = count
  }
  const card = await prisma.kanbanCard.create({
    data: {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      createdById: req.user!.id,
      assignees: assigneeIds?.length ? { create: assigneeIds.map(userId => ({ userId })) } : undefined,
      labels: labelIds?.length ? { create: labelIds.map(labelId => ({ labelId })) } : undefined,
    },
    include: CARD_INCLUDE,
  })
  await appendEvent('KanbanCard', card.id, 'CREATED', `Card "${card.title}" created`, req.user?.id)
  res.status(201).json(card)
})

router.patch('/cards/:id', requirePermission('kanban', 'edit'), async (req: AuthRequest, res) => {
  const { assigneeIds, labelIds, ...data } = cardSchema.partial().omit({ columnId: true }).parse(req.body)
  const card = await prisma.$transaction(async tx => {
    if (assigneeIds !== undefined) {
      await tx.kanbanCardAssignee.deleteMany({ where: { cardId: req.params.id as string } })
      if (assigneeIds.length) await tx.kanbanCardAssignee.createMany({ data: assigneeIds.map(userId => ({ cardId: req.params.id as string, userId })) })
    }
    if (labelIds !== undefined) {
      await tx.kanbanCardLabel.deleteMany({ where: { cardId: req.params.id as string } })
      if (labelIds.length) await tx.kanbanCardLabel.createMany({ data: labelIds.map(labelId => ({ cardId: req.params.id as string, labelId })) })
    }
    return tx.kanbanCard.update({
      where: { id: req.params.id as string },
      data: {
        ...data,
        dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
        startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : undefined,
      },
      include: CARD_INCLUDE,
    })
  })
  res.json(card)
})

// Move card to a new column/position — dedicated endpoint for drag-and-drop
const moveSchema = z.object({ columnId: z.string().min(1), order: z.number() })
router.post('/cards/:id/move', requirePermission('kanban', 'edit'), async (req, res) => {
  const { columnId, order } = moveSchema.parse(req.body)
  const card = await prisma.kanbanCard.update({
    where: { id: req.params.id as string },
    data: { columnId, order },
    include: CARD_INCLUDE,
  })
  res.json(card)
})

router.post('/cards/:id/archive', requirePermission('kanban', 'delete'), async (req: AuthRequest, res) => {
  const card = await prisma.kanbanCard.update({ where: { id: req.params.id as string }, data: { isArchived: true } })
  await appendEvent('KanbanCard', card.id, 'ARCHIVED', `Card "${card.title}" archived`, req.user?.id)
  res.json(card)
})

router.delete('/cards/:id', requirePermission('kanban', 'delete'), async (req, res) => {
  await prisma.kanbanCard.delete({ where: { id: req.params.id as string } })
  res.status(204).send()
})

// ── Checklist ─────────────────────────────────────────────────────────────────

router.post('/cards/:id/checklist', requirePermission('kanban', 'edit'), async (req, res) => {
  const { text } = req.body as { text: string }
  if (!text?.trim()) { res.status(400).json({ error: 'text required' }); return }
  const count = await prisma.kanbanChecklistItem.count({ where: { cardId: req.params.id as string } })
  const item = await prisma.kanbanChecklistItem.create({ data: { cardId: req.params.id as string, text: text.trim(), order: count } })
  res.status(201).json(item)
})

router.patch('/checklist/:id', requirePermission('kanban', 'edit'), async (req, res) => {
  const { text, done } = req.body as { text?: string; done?: boolean }
  const item = await prisma.kanbanChecklistItem.update({ where: { id: req.params.id as string }, data: { text, done } })
  res.json(item)
})

router.delete('/checklist/:id', requirePermission('kanban', 'edit'), async (req, res) => {
  await prisma.kanbanChecklistItem.delete({ where: { id: req.params.id as string } })
  res.status(204).send()
})

// ── Labels ────────────────────────────────────────────────────────────────────

router.post('/labels', requirePermission('kanban', 'create'), async (req, res) => {
  const { boardId, name, color } = req.body as { boardId: string; name: string; color?: string }
  if (!boardId || !name?.trim()) { res.status(400).json({ error: 'boardId and name required' }); return }
  const label = await prisma.kanbanLabel.create({ data: { boardId, name: name.trim(), color: color ?? '#5D78FF' } })
  res.status(201).json(label)
})

router.delete('/labels/:id', requirePermission('kanban', 'delete'), async (req, res) => {
  await prisma.kanbanLabel.delete({ where: { id: req.params.id as string } })
  res.status(204).send()
})

export default router
