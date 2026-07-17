import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const expenseUpdateSchema = z.object({
  title: z.string().optional(),
  amount: z.number().optional(),
  category: z.string().optional(),
  entityType: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),
  date: z.string().optional(),
  notes: z.string().nullable().optional(),
})

router.get('/', requirePermission('financial', 'read_all'), async (req, res) => {
  const { category, entityType, entityId, from, to } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'date')
  const where = {
    ...(category && { category }),
    ...(entityType && { entityType }),
    ...(entityId && { entityId }),
    ...(from || to ? { date: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}),
  }
  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.expense.count({ where }),
  ])
  res.json(paginate(expenses, total, pagination))
})

// Re-derives a project's totalExpenses/profit from its cost components — the same
// invariant every other cost-writing route (goods-receipts, work-orders, service-records)
// maintains, so "Other Expenses" (project-linked Expense rows) participate in the same
// auto-calculated total instead of being tracked separately and silently excluded.
async function recalcProjectTotals(tx: Prisma.TransactionClient, projectId: string) {
  const project = await tx.project.findUnique({ where: { id: projectId } })
  if (!project) return
  const otherExpenses = await tx.expense.aggregate({
    where: { entityType: 'project', entityId: projectId },
    _sum: { amount: true },
  })
  const newTotalExpenses = (project.purchaseCost || 0) + (project.manufacturingCost || 0) + (project.serviceCost || 0)
    + (project.labourCost || 0) + (project.installationCost || 0) + (otherExpenses._sum.amount || 0)
  await tx.project.update({
    where: { id: projectId },
    data: { totalExpenses: newTotalExpenses, profit: (project.budget || 0) - newTotalExpenses },
  })
}

router.post('/', requirePermission('financial', 'create'), async (req: AuthRequest, res) => {
  const { title, amount, category, entityType, entityId, date, notes } = req.body
  if (!title || !amount || !category || !date) {
    res.status(400).json({ error: 'title, amount, category, date required' }); return
  }
  const expense = await prisma.$transaction(async tx => {
    const created = await tx.expense.create({
      data: { title, amount: Number(amount), category, entityType: entityType ?? null, entityId: entityId ?? null, date: new Date(date), notes: notes ?? null },
    })
    if (entityType === 'project' && entityId) await recalcProjectTotals(tx, entityId)
    return created
  })
  res.status(201).json(expense)
})

router.patch('/:id', requirePermission('financial', 'edit'), async (req, res) => {
  try {
    const data = expenseUpdateSchema.parse(req.body)
    const expense = await prisma.$transaction(async tx => {
      const existing = await tx.expense.findUniqueOrThrow({ where: { id: req.params.id as string } })
      const updated = await tx.expense.update({
        where: { id: req.params.id as string },
        data: { ...data, date: data.date ? new Date(data.date) : undefined },
      })
      // Recalc both the old and new linked project, in case entityId/entityType changed.
      if (existing.entityType === 'project' && existing.entityId) await recalcProjectTotals(tx, existing.entityId)
      if (updated.entityType === 'project' && updated.entityId && updated.entityId !== existing.entityId) await recalcProjectTotals(tx, updated.entityId)
      return updated
    })
    res.json(expense)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to update expense' }) }
})

router.delete('/:id', requirePermission('financial', 'delete'), async (req, res) => {
  await prisma.$transaction(async tx => {
    const existing = await tx.expense.findUniqueOrThrow({ where: { id: req.params.id as string } })
    await tx.expense.delete({ where: { id: req.params.id as string } })
    if (existing.entityType === 'project' && existing.entityId) await recalcProjectTotals(tx, existing.entityId)
  })
  res.status(204).end()
})

// Monthly summary by category
router.get('/summary', requirePermission('financial', 'read_all'), async (req, res) => {
  const { months } = req.query as Record<string, string>
  const monthsBack = parseInt(months ?? '6')
  const from = new Date()
  from.setMonth(from.getMonth() - monthsBack)

  const expenses = await prisma.expense.findMany({
    where: { date: { gte: from } },
    select: { amount: true, category: true, date: true },
    orderBy: { date: 'asc' },
  })
  res.json(expenses)
})

export default router
