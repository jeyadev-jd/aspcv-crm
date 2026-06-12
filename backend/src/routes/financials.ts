import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const { type } = req.query as Record<string, string>
  const entries = await prisma.financialEntry.findMany({
    where: { ...(type && { type }) },
    orderBy: { asOf: 'desc' },
  })
  res.json(entries)
})

// Summary totals
router.get('/summary', async (_req, res) => {
  const [assets, liabilities] = await Promise.all([
    prisma.financialEntry.aggregate({ where: { type: 'asset' }, _sum: { amount: true } }),
    prisma.financialEntry.aggregate({ where: { type: 'liability' }, _sum: { amount: true } }),
  ])
  res.json({
    totalAssets: assets._sum.amount ?? 0,
    totalLiabilities: liabilities._sum.amount ?? 0,
    netWorth: (assets._sum.amount ?? 0) - (liabilities._sum.amount ?? 0),
  })
})

router.post('/', requirePermission('financial', 'create'), async (req: AuthRequest, res) => {
  const { type, name, amount, category, asOf, notes } = req.body
  if (!type || !name || !amount) { res.status(400).json({ error: 'type, name, amount required' }); return }
  const entry = await prisma.financialEntry.create({
    data: { type, name, amount: Number(amount), category: category ?? null, asOf: asOf ? new Date(asOf) : new Date(), notes: notes ?? null },
  })
  res.status(201).json(entry)
})

router.patch('/:id', requirePermission('financial', 'edit'), async (req: AuthRequest, res) => {
  const entry = await prisma.financialEntry.update({ where: { id: req.params.id as string }, data: req.body })
  res.json(entry)
})

router.delete('/:id', requirePermission('financial', 'delete'), async (req: AuthRequest, res) => {
  await prisma.financialEntry.delete({ where: { id: req.params.id as string } })
  res.status(204).end()
})

export default router
