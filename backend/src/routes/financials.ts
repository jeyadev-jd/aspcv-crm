import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const financialUpdateSchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  amount: z.number().optional(),
  category: z.string().nullable().optional(),
  asOf: z.string().optional(),
  notes: z.string().nullable().optional(),
})

router.get('/', requirePermission('financial', 'read_all'), async (req, res) => {
  const { type } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'asOf')
  const where = { ...(type && { type }) }
  const [entries, total] = await Promise.all([
    prisma.financialEntry.findMany({
      where,
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.financialEntry.count({ where }),
  ])
  res.json(paginate(entries, total, pagination))
})

// Summary totals
router.get('/summary', requirePermission('financial', 'read_all'), async (_req, res) => {
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
  try {
    const data = financialUpdateSchema.parse(req.body)
    const entry = await prisma.financialEntry.update({
      where: { id: req.params.id as string },
      data: { ...data, asOf: data.asOf ? new Date(data.asOf) : undefined },
    })
    res.json(entry)
  } catch (e: any) { res.status(e?.name === 'ZodError' ? 400 : 500).json({ error: e?.name === 'ZodError' ? e.errors : 'Failed to update entry' }) }
})

router.delete('/:id', requirePermission('financial', 'delete'), async (req: AuthRequest, res) => {
  await prisma.financialEntry.delete({ where: { id: req.params.id as string } })
  res.status(204).end()
})

export default router
