import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

function monthsBack(n: number): { year: number; month: number; label: string }[] {
  const out: { year: number; month: number; label: string }[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleDateString('en-US', { month: 'short' }) })
  }
  return out
}

// ── Revenue vs Target ─────────────────────────────────────────────────────────

router.get('/revenue', requirePermission('financial', 'read_all'), async (req, res) => {
  const months = parseInt(String(req.query.months || '6'))
  const range = monthsBack(months)

  const invoices = await prisma.invoice.findMany({
    where: { status: 'Paid' },
    select: { date: true, amount: true },
  })

  const targets = await prisma.revenueTarget.findMany({
    where: { OR: range.map(r => ({ year: r.year, month: r.month })) },
  })

  const data = range.map(r => {
    const actual = invoices
      .filter(inv => inv.date.getFullYear() === r.year && inv.date.getMonth() + 1 === r.month)
      .reduce((s, inv) => s + inv.amount, 0)
    const target = targets.find(t => t.year === r.year && t.month === r.month)?.targetAmount ?? null
    return { year: r.year, month: r.month, label: r.label, actual, target }
  })

  res.json(data)
})

const targetSchema = z.object({ month: z.number().min(1).max(12), year: z.number(), targetAmount: z.number().min(0) })

router.put('/revenue/target', requirePermission('financial', 'edit'), async (req, res) => {
  const data = targetSchema.parse(req.body)
  const target = await prisma.revenueTarget.upsert({
    where: { month_year: { month: data.month, year: data.year } },
    update: { targetAmount: data.targetAmount },
    create: data,
  })
  res.json(target)
})

// ── Pipeline by stage ─────────────────────────────────────────────────────────

router.get('/pipeline', requirePermission('deal', 'read_all'), async (req, res) => {
  const { departmentId } = req.query as Record<string, string>
  const deals = await prisma.deal.groupBy({
    by: ['stage'],
    where: { isActive: true, ...(departmentId && { departmentId }) },
    _sum: { value: true },
    _count: true,
  })
  res.json(deals.map(d => ({ stage: d.stage, value: d._sum.value ?? 0, count: d._count })))
})

// ── Sales funnel (lead status counts) ─────────────────────────────────────────

router.get('/funnel', requirePermission('lead', 'read_all'), async (req, res) => {
  const { departmentId } = req.query as Record<string, string>
  const leads = await prisma.lead.groupBy({
    by: ['status'],
    where: { isActive: true, ...(departmentId && { departmentId }) },
    _count: true,
  })
  res.json(leads.map(l => ({ status: l.status, count: l._count })))
})

// ── Rep leaderboard (deal owners, won deals) ──────────────────────────────────

router.get('/leaderboard', requirePermission('deal', 'read_all'), async (req, res) => {
  const owners = await prisma.dealOwner.findMany({
    include: { user: { select: { id: true, name: true, role: true } }, deal: { select: { stage: true, value: true, isActive: true } } },
  })
  const byUser = new Map<string, { name: string; role: string; wonCount: number; wonValue: number; totalDeals: number }>()
  for (const o of owners) {
    if (!o.deal.isActive) continue
    const entry = byUser.get(o.userId) ?? { name: o.user.name, role: o.user.role, wonCount: 0, wonValue: 0, totalDeals: 0 }
    entry.totalDeals += 1
    if (o.deal.stage === 'OrderWon') { entry.wonCount += 1; entry.wonValue += o.deal.value ?? 0 }
    byUser.set(o.userId, entry)
  }
  const rows = [...byUser.entries()].map(([userId, v]) => ({ userId, ...v })).sort((a, b) => b.wonValue - a.wonValue)
  res.json(rows)
})

// ── Product performance (from invoice line items — free text, no productId FK) ─

router.get('/product-performance', requirePermission('invoice', 'read_all'), async (req, res) => {
  const items = await prisma.invoiceItem.findMany({
    where: { invoice: { status: 'Paid' } },
    select: { item: true, amount: true },
  })
  const byItem = new Map<string, number>()
  for (const it of items) {
    byItem.set(it.item, (byItem.get(it.item) ?? 0) + it.amount)
  }
  const rows = [...byItem.entries()].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  res.json(rows)
})

// ── Support ticket trend (weekly, last N weeks) ───────────────────────────────

router.get('/tickets-trend', requirePermission('support', 'read_all'), async (req, res) => {
  const weeks = parseInt(String(req.query.weeks || '6'))
  const now = new Date()
  const start = new Date(now.getTime() - weeks * 7 * 86400000)

  const tickets = await prisma.supportTicket.findMany({
    where: { createdAt: { gte: start } },
    select: { createdAt: true, resolvedAt: true, status: true },
  })

  const data = []
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - (i + 1) * 7 * 86400000)
    const weekEnd = new Date(now.getTime() - i * 7 * 86400000)
    const open = tickets.filter(t => t.createdAt >= weekStart && t.createdAt < weekEnd).length
    const resolved = tickets.filter(t => t.resolvedAt && t.resolvedAt >= weekStart && t.resolvedAt < weekEnd).length
    data.push({ week: `W${weeks - i}`, open, resolved })
  }
  res.json(data)
})

// ── Department-wide breakdown (leads/deals/projects/tickets/revenue per dept) ─

router.get('/departments', requirePermission('financial', 'read_all'), async (req, res) => {
  const departments = await prisma.department.findMany({ where: { isActive: true } })
  const results = await Promise.all(departments.map(async dept => {
    const [leadCount, dealAgg, projectCount, wonDeals] = await Promise.all([
      prisma.lead.count({ where: { departmentId: dept.id, isActive: true } }),
      prisma.deal.aggregate({ where: { departmentId: dept.id, isActive: true }, _sum: { value: true }, _count: true }),
      prisma.project.count({ where: { departmentId: dept.id, isActive: true } }),
      prisma.deal.aggregate({ where: { departmentId: dept.id, isActive: true, stage: 'OrderWon' }, _sum: { value: true }, _count: true }),
    ])
    return {
      departmentId: dept.id,
      departmentName: dept.name,
      leadCount,
      dealCount: dealAgg._count,
      pipelineValue: dealAgg._sum.value ?? 0,
      projectCount,
      wonDealCount: wonDeals._count,
      wonValue: wonDeals._sum.value ?? 0,
    }
  }))
  res.json(results)
})

// ── Summary KPIs ───────────────────────────────────────────────────────────────

router.get('/summary', requirePermission('financial', 'read_all'), async (req, res) => {
  const [revenueAgg, pipelineAgg, wonAgg, totalDeals] = await Promise.all([
    prisma.invoice.aggregate({ where: { status: 'Paid' }, _sum: { amount: true } }),
    prisma.deal.aggregate({ where: { isActive: true, stage: { notIn: ['OrderWon', 'OrderLost'] } }, _sum: { value: true } }),
    prisma.deal.aggregate({ where: { isActive: true, stage: 'OrderWon' }, _sum: { value: true }, _count: true }),
    prisma.deal.count({ where: { isActive: true } }),
  ])
  const winRate = totalDeals > 0 ? Math.round((wonAgg._count / totalDeals) * 100) : 0
  res.json({
    revenueTotal: revenueAgg._sum.amount ?? 0,
    pipelineValue: pipelineAgg._sum.value ?? 0,
    wonValue: wonAgg._sum.value ?? 0,
    winRate,
  })
})

export default router
