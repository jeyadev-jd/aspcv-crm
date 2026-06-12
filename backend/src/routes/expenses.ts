import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const { category, entityType, entityId, from, to } = req.query as Record<string, string>
  const expenses = await prisma.expense.findMany({
    where: {
      ...(category && { category }),
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(from || to ? { date: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}),
    },
    orderBy: { date: 'desc' },
  })
  res.json(expenses)
})

router.post('/', requirePermission('financial', 'create'), async (req: AuthRequest, res) => {
  const { title, amount, category, entityType, entityId, date, notes } = req.body
  if (!title || !amount || !category || !date) {
    res.status(400).json({ error: 'title, amount, category, date required' }); return
  }
  const expense = await prisma.expense.create({
    data: { title, amount: Number(amount), category, entityType: entityType ?? null, entityId: entityId ?? null, date: new Date(date), notes: notes ?? null },
  })
  res.status(201).json(expense)
})

router.patch('/:id', requirePermission('financial', 'edit'), async (req, res) => {
  const expense = await prisma.expense.update({ where: { id: req.params.id as string }, data: req.body })
  res.json(expense)
})

router.delete('/:id', requirePermission('financial', 'delete'), async (req, res) => {
  await prisma.expense.delete({ where: { id: req.params.id as string } })
  res.status(204).end()
})

// Monthly summary by category
router.get('/summary', async (req, res) => {
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
