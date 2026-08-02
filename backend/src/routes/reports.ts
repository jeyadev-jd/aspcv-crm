import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

interface MonthSlot { year: number; month: number; label: string }

function monthsBack(n: number): MonthSlot[] {
  const out: MonthSlot[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleDateString('en-US', { month: 'short' }) })
  }
  return out
}

/**
 * Reporting window. Callers send either an explicit `from`/`to` month pair
 * (YYYY-MM, inclusive at both ends) or a rolling `months=N`. Everything below
 * reports against the same window so the tabs cannot disagree with each other.
 */
interface Range { start: Date; end: Date; slots: MonthSlot[] }

function parseRange(query: Record<string, unknown>): Range {
  const from = typeof query.from === 'string' ? query.from : undefined
  const to = typeof query.to === 'string' ? query.to : undefined
  const monthRe = /^\d{4}-\d{2}$/

  if (from && to && monthRe.test(from) && monthRe.test(to)) {
    const [fy, fm] = from.split('-').map(Number)
    const [ty, tm] = to.split('-').map(Number)
    let start = new Date(fy!, fm! - 1, 1)
    // `to` is inclusive, so the exclusive end is the first of the next month.
    let end = new Date(ty!, tm!, 1)
    // Tolerate a reversed range rather than returning an empty report.
    if (end < start) { const swap = start; start = new Date(ty!, tm! - 1, 1); end = new Date(swap.getFullYear(), swap.getMonth() + 1, 1) }

    const slots: MonthSlot[] = []
    const cursor = new Date(start)
    // Bounded so a wide range cannot generate an unusable number of columns.
    while (cursor < end && slots.length < 60) {
      slots.push({
        year: cursor.getFullYear(),
        month: cursor.getMonth() + 1,
        label: cursor.toLocaleDateString('en-US', { month: 'short' }),
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return { start, end, slots }
  }

  const months = Math.min(60, Math.max(1, parseInt(String(query.months ?? '6')) || 6))
  const slots = monthsBack(months)
  const first = slots[0]!
  const last = slots[slots.length - 1]!
  return {
    start: new Date(first.year, first.month - 1, 1),
    end: new Date(last.year, last.month, 1),
    slots,
  }
}

/** Shared shape so the UI can say "no data" vs "not enough data" consistently. */
function coverage(count: number, minimum = 1) {
  return { count, sufficient: count >= minimum }
}

// ── Revenue vs Target ─────────────────────────────────────────────────────────

router.get('/revenue', requirePermission('financial', 'read_all'), async (req, res) => {
  const range = parseRange(req.query as Record<string, unknown>)

  const invoices = await prisma.invoice.findMany({
    where: { status: 'Paid', date: { gte: range.start, lt: range.end } },
    select: { date: true, amount: true },
  })

  const targets = await prisma.revenueTarget.findMany({
    where: { OR: range.slots.map(r => ({ year: r.year, month: r.month })) },
  })

  const data = range.slots.map(r => {
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
  const range = parseRange(req.query as Record<string, unknown>)
  const deals = await prisma.deal.groupBy({
    by: ['stage'],
    where: {
      isActive: true,
      ...(departmentId && { departmentId }),
      createdAt: { gte: range.start, lt: range.end },
    },
    _sum: { value: true },
    _count: true,
  })
  res.json(deals.map(d => ({ stage: d.stage, value: d._sum.value ?? 0, count: d._count })))
})

// ── Pipeline value: totals, weighting, and month-by-month movement ───────────

const OPEN_STAGES = ['LeadIn', 'Proposal', 'Negotiation'] as const

router.get('/pipeline-value', requirePermission('deal', 'read_all'), async (req, res) => {
  const { departmentId } = req.query as Record<string, string>
  const range = parseRange(req.query as Record<string, unknown>)
  const scope = { isActive: true, ...(departmentId && { departmentId }) }

  const deals = await prisma.deal.findMany({
    where: { ...scope, createdAt: { gte: range.start, lt: range.end } },
    select: { stage: true, value: true, probability: true, closeDate: true, createdAt: true },
  })

  const open = deals.filter(d => (OPEN_STAGES as readonly string[]).includes(d.stage))
  const openValue = open.reduce((s, d) => s + (d.value ?? 0), 0)
  // Probability-weighted pipeline — the number a forecast should actually use,
  // rather than the raw sum which treats a new lead like a signed order.
  const weightedValue = open.reduce((s, d) => s + (d.value ?? 0) * ((d.probability ?? 0) / 100), 0)
  const won = deals.filter(d => d.stage === 'OrderWon')
  const lost = deals.filter(d => d.stage === 'OrderLost')

  const byStage = (OPEN_STAGES as readonly string[]).map(stage => {
    const rows = open.filter(d => d.stage === stage)
    const value = rows.reduce((s, d) => s + (d.value ?? 0), 0)
    return {
      stage,
      count: rows.length,
      value,
      weighted: rows.reduce((s, d) => s + (d.value ?? 0) * ((d.probability ?? 0) / 100), 0),
      sharePct: openValue > 0 ? Math.round((value / openValue) * 100) : 0,
    }
  })

  // Value entering the pipeline vs value closing out of it, per month.
  const trend = range.slots.map(slot => {
    const inMonth = (d: Date | null | undefined) =>
      !!d && d.getFullYear() === slot.year && d.getMonth() + 1 === slot.month
    return {
      label: `${slot.label} ${String(slot.year).slice(2)}`,
      created: deals.filter(d => inMonth(d.createdAt)).reduce((s, d) => s + (d.value ?? 0), 0),
      won: won.filter(d => inMonth(d.closeDate ?? d.createdAt)).reduce((s, d) => s + (d.value ?? 0), 0),
      lost: lost.filter(d => inMonth(d.closeDate ?? d.createdAt)).reduce((s, d) => s + (d.value ?? 0), 0),
    }
  })

  res.json({
    openCount: open.length,
    openValue,
    weightedValue: Math.round(weightedValue),
    wonValue: won.reduce((s, d) => s + (d.value ?? 0), 0),
    lostValue: lost.reduce((s, d) => s + (d.value ?? 0), 0),
    // Null rather than 0 when there is no open pipeline to average over.
    avgDealSize: open.length ? Math.round(openValue / open.length) : null,
    byStage,
    trend,
  })
})

// ── Sales funnel (lead status counts) ─────────────────────────────────────────

router.get('/funnel', requirePermission('lead', 'read_all'), async (req, res) => {
  const { departmentId } = req.query as Record<string, string>
  const range = parseRange(req.query as Record<string, unknown>)
  const leads = await prisma.lead.groupBy({
    by: ['status'],
    where: {
      isActive: true,
      ...(departmentId && { departmentId }),
      createdAt: { gte: range.start, lt: range.end },
    },
    _count: true,
  })
  res.json(leads.map(l => ({ status: l.status, count: l._count })))
})

// ── Rep leaderboard (deal owners, won deals) ──────────────────────────────────

router.get('/leaderboard', requirePermission('deal', 'read_all'), async (req, res) => {
  const range = parseRange(req.query as Record<string, unknown>)
  const owners = await prisma.dealOwner.findMany({
    include: {
      user: { select: { id: true, name: true, role: true } },
      deal: { select: { stage: true, value: true, isActive: true, createdAt: true } },
    },
  })
  const byUser = new Map<string, { name: string; role: string; wonCount: number; wonValue: number; totalDeals: number }>()
  for (const o of owners) {
    if (!o.deal.isActive) continue
    if (o.deal.createdAt < range.start || o.deal.createdAt >= range.end) continue
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
  const range = parseRange(req.query as Record<string, unknown>)
  const items = await prisma.invoiceItem.findMany({
    where: { invoice: { status: 'Paid', date: { gte: range.start, lt: range.end } } },
    select: { item: true, amount: true },
  })
  const byItem = new Map<string, number>()
  for (const it of items) {
    byItem.set(it.item, (byItem.get(it.item) ?? 0) + it.amount)
  }
  const rows = [...byItem.entries()].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  res.json(rows)
})

// ── Support ticket trend (monthly across the selected window) ─────────────────

router.get('/tickets-trend', requirePermission('support', 'read_all'), async (req, res) => {
  const range = parseRange(req.query as Record<string, unknown>)

  const tickets = await prisma.supportTicket.findMany({
    where: {
      isActive: true,
      OR: [
        { createdAt: { gte: range.start, lt: range.end } },
        { resolvedAt: { gte: range.start, lt: range.end } },
      ],
    },
    select: { createdAt: true, resolvedAt: true },
  })

  const data = range.slots.map(slot => {
    const inMonth = (d: Date | null) =>
      !!d && d.getFullYear() === slot.year && d.getMonth() + 1 === slot.month
    return {
      label: `${slot.label} ${String(slot.year).slice(2)}`,
      // `week` retained so older clients keep rendering while they update.
      week: `${slot.label} ${String(slot.year).slice(2)}`,
      opened: tickets.filter(t => inMonth(t.createdAt)).length,
      open: tickets.filter(t => inMonth(t.createdAt)).length,
      resolved: tickets.filter(t => inMonth(t.resolvedAt)).length,
    }
  })
  res.json(data)
})

// ── Support ticket analytics (SLA, ownership, project attribution) ────────────

router.get('/tickets', requirePermission('support', 'read_all'), async (req, res) => {
  const range = parseRange(req.query as Record<string, unknown>)
  const now = new Date()
  const where = { isActive: true, createdAt: { gte: range.start, lt: range.end } }

  const [tickets, byPriority, byCategory, byStatus] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      select: {
        id: true, createdAt: true, resolvedAt: true, dueDate: true, status: true, priority: true,
        assignedTo: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
    }),
    prisma.supportTicket.groupBy({ by: ['priority'], where, _count: { _all: true } }),
    prisma.supportTicket.groupBy({ by: ['category'], where, _count: { _all: true } }),
    prisma.supportTicket.groupBy({ by: ['status'], where, _count: { _all: true } }),
  ])

  const resolved = tickets.filter(t => t.resolvedAt)
  const slaScored = resolved.filter(t => t.dueDate)
  const metSla = slaScored.filter(t => t.resolvedAt! <= t.dueDate!).length
  const durations = resolved.map(t => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3_600_000)

  // Per-owner throughput. Unassigned work is surfaced as its own bucket rather
  // than dropped, otherwise the totals silently stop adding up.
  const byAssignee = new Map<string, { name: string; total: number; resolved: number; breached: number }>()
  for (const t of tickets) {
    const key = t.assignedTo?.id ?? 'unassigned'
    const entry = byAssignee.get(key) ?? { name: t.assignedTo?.name ?? 'Unassigned', total: 0, resolved: 0, breached: 0 }
    entry.total += 1
    if (t.resolvedAt) entry.resolved += 1
    if (t.dueDate && (t.resolvedAt ? t.resolvedAt > t.dueDate : t.dueDate < now && t.status !== 'Closed')) entry.breached += 1
    byAssignee.set(key, entry)
  }

  const byProject = new Map<string, { title: string; total: number; open: number }>()
  for (const t of tickets) {
    const key = t.project?.id ?? 'none'
    const entry = byProject.get(key) ?? { title: t.project?.title ?? 'No project', total: 0, open: 0 }
    entry.total += 1
    if (t.status === 'Open' || t.status === 'InProgress') entry.open += 1
    byProject.set(key, entry)
  }

  res.json({
    coverage: coverage(tickets.length),
    total: tickets.length,
    resolvedCount: resolved.length,
    overdue: tickets.filter(t => t.dueDate && t.dueDate < now && (t.status === 'Open' || t.status === 'InProgress')).length,
    unassigned: tickets.filter(t => !t.assignedTo).length,
    // Null rather than 0 whenever the sample is empty, so the UI distinguishes
    // "perfect score" from "nothing measured yet".
    slaCompliancePct: slaScored.length ? Math.round((metSla / slaScored.length) * 100) : null,
    slaSampleSize: slaScored.length,
    avgResolutionHours: durations.length
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
      : null,
    byStatus: byStatus.map(r => ({ status: r.status, count: r._count._all })),
    byPriority: byPriority.map(r => ({ priority: r.priority, count: r._count._all })),
    byCategory: byCategory.map(r => ({ category: r.category ?? 'Uncategorised', count: r._count._all })),
    byAssignee: [...byAssignee.entries()].map(([userId, v]) => ({ userId, ...v })).sort((a, b) => b.total - a.total),
    byProject: [...byProject.entries()].map(([projectId, v]) => ({ projectId, ...v })).sort((a, b) => b.total - a.total).slice(0, 10),
  })
})

// ── Project delivery & cost performance ──────────────────────────────────────

router.get('/projects', requirePermission('project', 'read_all'), async (req, res) => {
  const range = parseRange(req.query as Record<string, unknown>)
  const where = { isActive: true, createdAt: { gte: range.start, lt: range.end } }

  const [projects, byStatus] = await Promise.all([
    prisma.project.findMany({
      where,
      select: {
        id: true, title: true, status: true, budget: true, totalExpenses: true, profit: true,
        expectedCompletionDate: true, completedAt: true, progress: true,
        department: { select: { id: true, name: true } },
      },
    }),
    prisma.project.groupBy({ by: ['status'], where, _count: { _all: true } }),
  ])

  const completed = projects.filter(p => p.completedAt)
  const withTarget = completed.filter(p => p.expectedCompletionDate)
  const onTime = withTarget.filter(p => p.completedAt! <= p.expectedCompletionDate!).length

  const budgeted = projects.filter(p => (p.budget ?? 0) > 0)
  const overBudget = budgeted.filter(p => (p.totalExpenses ?? 0) > (p.budget ?? 0))

  res.json({
    coverage: coverage(projects.length),
    total: projects.length,
    completedCount: completed.length,
    activeCount: projects.filter(p => p.status !== 'Completed' && p.status !== 'Cancelled').length,
    byStatus: byStatus.map(r => ({ status: r.status, count: r._count._all })),
    // Null when no completed project carried an expected date — a 0% here would
    // read as "everything was late", which is not what the data says.
    onTimePct: withTarget.length ? Math.round((onTime / withTarget.length) * 100) : null,
    onTimeSampleSize: withTarget.length,
    totalBudget: projects.reduce((s, p) => s + (p.budget ?? 0), 0),
    totalSpend: projects.reduce((s, p) => s + (p.totalExpenses ?? 0), 0),
    totalProfit: projects.reduce((s, p) => s + (p.profit ?? 0), 0),
    overBudgetCount: overBudget.length,
    budgetedCount: budgeted.length,
    avgProgress: projects.length
      ? Math.round(projects.reduce((s, p) => s + (p.progress ?? 0), 0) / projects.length)
      : null,
    topOverBudget: overBudget
      .map(p => ({
        id: p.id, title: p.title, budget: p.budget ?? 0, spend: p.totalExpenses ?? 0,
        overBy: (p.totalExpenses ?? 0) - (p.budget ?? 0),
      }))
      .sort((a, b) => b.overBy - a.overBy)
      .slice(0, 8),
  })
})

// ── Department-wide breakdown (leads/deals/projects/tickets/revenue per dept) ─

router.get('/departments', requirePermission('financial', 'read_all'), async (req, res) => {
  const range = parseRange(req.query as Record<string, unknown>)
  const window = { gte: range.start, lt: range.end }
  const departments = await prisma.department.findMany({ where: { isActive: true } })
  const results = await Promise.all(departments.map(async dept => {
    const [leadCount, dealAgg, projectCount, wonDeals] = await Promise.all([
      prisma.lead.count({ where: { departmentId: dept.id, isActive: true, createdAt: window } }),
      prisma.deal.aggregate({ where: { departmentId: dept.id, isActive: true, createdAt: window }, _sum: { value: true }, _count: true }),
      prisma.project.count({ where: { departmentId: dept.id, isActive: true, createdAt: window } }),
      prisma.deal.aggregate({ where: { departmentId: dept.id, isActive: true, stage: 'OrderWon', createdAt: window }, _sum: { value: true }, _count: true }),
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
  const range = parseRange(req.query as Record<string, unknown>)
  const window = { gte: range.start, lt: range.end }
  const [revenueAgg, pipelineAgg, wonAgg, totalDeals, invoiceCount] = await Promise.all([
    prisma.invoice.aggregate({ where: { status: 'Paid', date: window }, _sum: { amount: true } }),
    prisma.deal.aggregate({ where: { isActive: true, stage: { notIn: ['OrderWon', 'OrderLost'] }, createdAt: window }, _sum: { value: true } }),
    prisma.deal.aggregate({ where: { isActive: true, stage: 'OrderWon', createdAt: window }, _sum: { value: true }, _count: true }),
    prisma.deal.count({ where: { isActive: true, createdAt: window } }),
    prisma.invoice.count({ where: { status: 'Paid', date: window } }),
  ])
  res.json({
    revenueTotal: revenueAgg._sum.amount ?? 0,
    pipelineValue: pipelineAgg._sum.value ?? 0,
    wonValue: wonAgg._sum.value ?? 0,
    // Null when no deal closed in the window — 0% would imply every deal lost.
    winRate: totalDeals > 0 ? Math.round((wonAgg._count / totalDeals) * 100) : null,
    dealCount: totalDeals,
    invoiceCount,
    rangeStart: range.start.toISOString(),
    rangeEnd: range.end.toISOString(),
  })
})

export default router
