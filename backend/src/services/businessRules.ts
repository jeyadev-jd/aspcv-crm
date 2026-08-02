import prisma from '../lib/prisma'
import { registerRule, RuleConfig, RuleTrigger } from './rulesEngine'

function severityForTier(tier: number, tiers: number[]): 'info' | 'warning' | 'critical' {
  const idx = tiers.indexOf(tier)
  if (idx >= tiers.length - 1) return 'critical'
  if (idx >= Math.floor(tiers.length / 2)) return 'warning'
  return 'info'
}

// ── Priority 1: Project Financial Health ──────────────────────────────────────

// project_budget_tier: fires once per crossed tier (25/50/75/90/100 by default, configurable)
registerRule('project_budget_tier', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const tiers = (config.tiers as number[] | undefined) ?? [25, 50, 75, 90, 100]
  const projects = await prisma.project.findMany({ where: { isActive: true, budget: { gt: 0 } } })
  const out: RuleTrigger[] = []
  for (const p of projects) {
    const spent = p.actualBudget ?? p.totalExpenses ?? 0
    const budget = p.budget ?? 0
    if (budget <= 0) continue
    const pct = (spent / budget) * 100
    const crossedTiers = tiers.filter(t => pct >= t).sort((a, b) => b - a)
    if (!crossedTiers.length) continue
    const highest = crossedTiers[0]
    out.push({
      entityType: 'Project', entityId: p.id, tierKey: String(highest),
      severity: severityForTier(highest, tiers),
      title: `Budget alert: ${p.title}`,
      message: `${p.title} has consumed ${Math.round(pct)}% of its ${budget.toLocaleString()} budget (tier: ${highest}%).`,
    })
  }
  return out
})

// project_budget_progress_mismatch: spend outpacing delivered progress
registerRule('project_budget_progress_mismatch', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const gapThreshold = (config.gapPercent as number | undefined) ?? 30
  const projects = await prisma.project.findMany({ where: { isActive: true, budget: { gt: 0 } } })
  const out: RuleTrigger[] = []
  for (const p of projects) {
    const spent = p.actualBudget ?? p.totalExpenses ?? 0
    const budget = p.budget ?? 0
    if (budget <= 0) continue
    const spentPct = (spent / budget) * 100
    const progress = p.progress ?? 0
    const gap = spentPct - progress
    if (gap < gapThreshold) continue
    out.push({
      entityType: 'Project', entityId: p.id, tierKey: `mismatch_${Math.floor(gap / 10) * 10}`,
      severity: gap >= gapThreshold * 2 ? 'critical' : 'warning',
      title: `Budget outpacing progress: ${p.title}`,
      message: `${p.title}: ${Math.round(spentPct)}% of budget spent but only ${progress}% complete (gap ${Math.round(gap)} pts).`,
    })
  }
  return out
})

// project_stale_update: no updatedAt change for N days (configurable, default 7)
registerRule('project_stale_update', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const staleDays = (config.staleDays as number | undefined) ?? 7
  const cutoff = new Date(Date.now() - staleDays * 86400_000)
  const projects = await prisma.project.findMany({
    where: { isActive: true, isLocked: false, updatedAt: { lte: cutoff }, status: { notIn: ['Completed', 'Cancelled'] } },
  })
  return projects.map(p => ({
    entityType: 'Project', entityId: p.id, tierKey: `stale_${staleDays}`,
    severity: 'warning' as const,
    title: `No update: ${p.title}`,
    message: `${p.title} has had no updates for ${staleDays}+ days.`,
  }))
})

// ── Priority 2: Finance ─────────────────────────────────────────────────────

// invoice_overdue: unpaid invoice past its date by configurable day tiers (7/15/30 default)
registerRule('invoice_overdue', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const tiers = (config.dayTiers as number[] | undefined) ?? [7, 15, 30]
  const invoices = await prisma.invoice.findMany({ where: { status: 'Unpaid' } })
  const out: RuleTrigger[] = []
  const now = Date.now()
  for (const inv of invoices) {
    const daysOverdue = Math.floor((now - inv.date.getTime()) / 86400_000)
    const crossedTiers = tiers.filter(t => daysOverdue >= t).sort((a, b) => b - a)
    if (!crossedTiers.length) continue
    const highest = crossedTiers[0]
    out.push({
      entityType: 'Invoice', entityId: inv.id, tierKey: `overdue_${highest}`,
      severity: severityForTier(highest, tiers),
      title: `Invoice overdue: ${inv.number}`,
      message: `Invoice ${inv.number} for ${inv.customer} is ${daysOverdue} days overdue (₹${inv.amount.toLocaleString()}).`,
    })
  }
  return out
})

// ── Priority 3: Inventory ───────────────────────────────────────────────────

// stock_level: low / critical / out-of-stock tiers, configurable thresholds
registerRule('stock_level', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const lowThreshold = (config.lowThreshold as number | undefined) ?? 10
  const criticalThreshold = (config.criticalThreshold as number | undefined) ?? 5
  const components = await prisma.rawComponent.findMany({ where: { status: 'in_stock', quantity: { lte: lowThreshold } } })
  const out: RuleTrigger[] = []
  for (const c of components) {
    const qty = c.quantity ?? 0
    const tierKey = qty <= 0 ? 'out_of_stock' : qty <= criticalThreshold ? 'critical' : 'low'
    const severity = qty <= 0 ? 'critical' as const : qty <= criticalThreshold ? 'critical' as const : 'warning' as const
    out.push({
      entityType: 'RawComponent', entityId: c.id, tierKey,
      severity,
      title: `${tierKey === 'out_of_stock' ? 'Out of stock' : tierKey === 'critical' ? 'Critical stock' : 'Low stock'}: ${c.name}`,
      message: `${c.name} (${c.refNumber}) has ${qty} ${c.unit ?? 'unit(s)'} remaining.`,
    })
  }
  return out
})

// material_request_pending: MR sitting in pending/partial state too long
registerRule('material_request_pending', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const pendingHours = (config.pendingHours as number | undefined) ?? 48
  const cutoff = new Date(Date.now() - pendingHours * 3600_000)
  const mrs = await prisma.materialRequest.findMany({
    where: { status: { in: ['pending', 'partial_approved'] }, createdAt: { lte: cutoff }, rejectedById: null },
  })
  return mrs.map(mr => ({
    entityType: 'MaterialRequest', entityId: mr.id, tierKey: `pending_${pendingHours}h`,
    severity: 'warning' as const,
    title: `MR pending too long: ${mr.refNumber}`,
    message: `Material Request ${mr.refNumber} has been pending for over ${Math.floor(pendingHours / 24)} day(s).`,
  }))
})

// ── Priority 4: Procurement ─────────────────────────────────────────────────

// po_pending_approval: PO stuck in Draft too long
registerRule('po_pending_approval', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const pendingHours = (config.pendingHours as number | undefined) ?? 24
  const cutoff = new Date(Date.now() - pendingHours * 3600_000)
  const pos = await prisma.purchaseOrder.findMany({ where: { status: 'Draft', createdAt: { lte: cutoff } } })
  return pos.map(po => ({
    entityType: 'PurchaseOrder', entityId: po.id, tierKey: `pending_${pendingHours}h`,
    severity: 'warning' as const,
    title: `PO pending approval: ${po.refNumber}`,
    message: `Purchase Order ${po.refNumber} (${po.supplierName}, ₹${po.totalAmount.toLocaleString()}) awaiting approval for over ${Math.floor(pendingHours / 24)} day(s).`,
  }))
})

// ── Finance Intelligence ────────────────────────────────────────────────────

// revenue_vs_target: current month's paid-invoice revenue vs RevenueTarget, above or below
registerRule('revenue_vs_target', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const belowPercent = (config.belowPercent as number | undefined) ?? 80
  const abovePercent = (config.abovePercent as number | undefined) ?? 120
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const target = await prisma.revenueTarget.findUnique({ where: { month_year: { month, year } } })
  if (!target || target.targetAmount <= 0) return []

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  const agg = await prisma.invoice.aggregate({
    where: { status: 'Paid', paidAt: { gte: start, lt: end } },
    _sum: { amount: true },
  })
  const revenue = agg._sum.amount ?? 0
  const pct = (revenue / target.targetAmount) * 100
  const entityId = `revenue_${year}_${month}`

  if (pct < belowPercent) {
    return [{
      entityType: 'RevenueTarget', entityId, tierKey: `below_${Math.floor(pct / 10) * 10}`,
      severity: pct < belowPercent / 2 ? 'critical' : 'warning',
      title: 'Revenue below monthly target',
      message: `Revenue for ${month}/${year} is ₹${revenue.toLocaleString()} (${Math.round(pct)}% of ₹${target.targetAmount.toLocaleString()} target).`,
    }]
  }
  if (pct > abovePercent) {
    return [{
      entityType: 'RevenueTarget', entityId, tierKey: `above_${Math.floor(pct / 10) * 10}`,
      severity: 'info',
      title: 'Revenue above monthly target',
      message: `Revenue for ${month}/${year} is ₹${revenue.toLocaleString()} (${Math.round(pct)}% of ₹${target.targetAmount.toLocaleString()} target).`,
    }]
  }
  return []
})

// expense_exceeds_budget: project total expenses exceed its budget outright
registerRule('expense_exceeds_budget', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const overagePercent = (config.overagePercent as number | undefined) ?? 0
  const projects = await prisma.project.findMany({ where: { isActive: true, budget: { gt: 0 } } })
  const out: RuleTrigger[] = []
  for (const p of projects) {
    const spent = p.actualBudget ?? p.totalExpenses ?? 0
    const budget = p.budget ?? 0
    if (budget <= 0) continue
    const overPct = ((spent - budget) / budget) * 100
    if (overPct <= overagePercent) continue
    out.push({
      entityType: 'Project', entityId: p.id, tierKey: `overage_${Math.floor(overPct / 10) * 10}`,
      severity: 'critical',
      title: `Budget exceeded: ${p.title}`,
      message: `${p.title} has spent ₹${spent.toLocaleString()}, exceeding its ₹${budget.toLocaleString()} budget by ${Math.round(overPct)}%.`,
    })
  }
  return out
})

// project_profit_margin_low: profit margin (profit / revenue proxy = budget) below threshold on completed/near-complete projects
registerRule('project_profit_margin_low', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const minMarginPercent = (config.minMarginPercent as number | undefined) ?? 15
  const projects = await prisma.project.findMany({ where: { isActive: true, budget: { gt: 0 }, progress: { gte: 50 } } })
  const out: RuleTrigger[] = []
  for (const p of projects) {
    const budget = p.budget ?? 0
    if (budget <= 0) continue
    const margin = ((p.profit ?? 0) / budget) * 100
    if (margin >= minMarginPercent) continue
    out.push({
      entityType: 'Project', entityId: p.id, tierKey: `margin_${Math.floor(margin / 5) * 5}`,
      severity: margin < 0 ? 'critical' : 'warning',
      title: `Low profit margin: ${p.title}`,
      message: `${p.title} has a profit margin of ${Math.round(margin)}% (below ${minMarginPercent}% threshold).`,
    })
  }
  return out
})

// customer_payment_overdue: alias view of invoice_overdue framed as customer-facing (kept distinct per business ask)
registerRule('customer_payment_overdue', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const tiers = (config.dayTiers as number[] | undefined) ?? [7, 15, 30]
  const invoices = await prisma.invoice.findMany({ where: { status: 'Unpaid' } })
  const out: RuleTrigger[] = []
  const now = Date.now()
  for (const inv of invoices) {
    const daysOverdue = Math.floor((now - inv.date.getTime()) / 86400_000)
    const crossed = tiers.filter(t => daysOverdue >= t).sort((a, b) => b - a)
    if (!crossed.length) continue
    out.push({
      entityType: 'Invoice', entityId: inv.id, tierKey: `customer_overdue_${crossed[0]}`,
      severity: severityForTier(crossed[0], tiers),
      title: `Customer payment overdue: ${inv.customer}`,
      message: `${inv.customer} owes ₹${inv.amount.toLocaleString()} on invoice ${inv.number}, ${daysOverdue} days overdue.`,
    })
  }
  return out
})

// vendor_payment_overdue: approved PO not marked vendorPaidAt within configurable days of delivery
registerRule('vendor_payment_overdue', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const graceDays = (config.graceDays as number | undefined) ?? 30
  const cutoff = new Date(Date.now() - graceDays * 86400_000)
  const pos = await prisma.purchaseOrder.findMany({
    where: { status: { in: ['Delivered'] }, vendorPaidAt: null, deliveredAt: { lte: cutoff } },
  })
  return pos.map(po => ({
    entityType: 'PurchaseOrder', entityId: po.id, tierKey: `vendor_overdue_${graceDays}`,
    severity: 'warning' as const,
    title: `Vendor payment overdue: ${po.supplierName}`,
    message: `PO ${po.refNumber} to ${po.supplierName} (₹${po.totalAmount.toLocaleString()}) delivered ${graceDays}+ days ago, still unpaid.`,
  }))
})

// cash_flow_low: paid revenue minus expenses over a trailing window below configurable floor
registerRule('cash_flow_low', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const windowDays = (config.windowDays as number | undefined) ?? 30
  const floorAmount = (config.floorAmount as number | undefined) ?? 0
  const since = new Date(Date.now() - windowDays * 86400_000)
  const [revenueAgg, expenseAgg] = await Promise.all([
    prisma.invoice.aggregate({ where: { status: 'Paid', paidAt: { gte: since } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { date: { gte: since } }, _sum: { amount: true } }),
  ])
  const net = (revenueAgg._sum.amount ?? 0) - (expenseAgg._sum.amount ?? 0)
  if (net >= floorAmount) return []
  return [{
    entityType: 'CashFlow', entityId: `cashflow_${windowDays}d`, tierKey: `low_${Math.floor(net / 10000) * 10000}`,
    severity: net < 0 ? 'critical' : 'warning',
    title: 'Cash flow below threshold',
    message: `Net cash flow over the last ${windowDays} days is ₹${net.toLocaleString()}, below the ₹${floorAmount.toLocaleString()} floor.`,
  }]
})

// large_invoice_generated: newly created invoice above configurable amount
registerRule('large_invoice_generated', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const amountThreshold = (config.amountThreshold as number | undefined) ?? 500000
  const lookbackHours = (config.lookbackHours as number | undefined) ?? 24
  const since = new Date(Date.now() - lookbackHours * 3600_000)
  const invoices = await prisma.invoice.findMany({ where: { amount: { gte: amountThreshold }, createdAt: { gte: since } } })
  return invoices.map(inv => ({
    entityType: 'Invoice', entityId: inv.id, tierKey: 'large_invoice',
    severity: 'info' as const,
    title: `Large invoice generated: ${inv.number}`,
    message: `Invoice ${inv.number} for ${inv.customer} was generated for ₹${inv.amount.toLocaleString()}.`,
  }))
})

// high_value_payment_received: invoice marked Paid above configurable amount
registerRule('high_value_payment_received', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const amountThreshold = (config.amountThreshold as number | undefined) ?? 500000
  const lookbackHours = (config.lookbackHours as number | undefined) ?? 24
  const since = new Date(Date.now() - lookbackHours * 3600_000)
  const invoices = await prisma.invoice.findMany({ where: { status: 'Paid', amount: { gte: amountThreshold }, paidAt: { gte: since } } })
  return invoices.map(inv => ({
    entityType: 'Invoice', entityId: inv.id, tierKey: 'high_value_payment',
    severity: 'info' as const,
    title: `High-value payment received: ${inv.customer}`,
    message: `Received ₹${inv.amount.toLocaleString()} from ${inv.customer} on invoice ${inv.number}.`,
  }))
})

// unapproved_expenses_stale: expenses with no linked entity approval trail, older than X days
// Note: Expense model has no approval workflow fields — this treats "unapproved" as
// entityId-less/orphan expenses (not yet attributed to a project/department) sitting stale.
// leave_carry_forward_year_end: on April 1 (new FY), carry forward EL balances
// Runs every 5 min but is idempotent — only acts if today is April 1 and new year balances don't exist yet
registerRule('leave_carry_forward_year_end', async (_config: RuleConfig): Promise<RuleTrigger[]> => {
  const now = new Date()
  // Only run on April 1 (start of Indian FY)
  if (now.getMonth() !== 3 || now.getDate() !== 1) return []

  const prevYear = now.getFullYear() - 1
  const newYear = now.getFullYear()

  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } })
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } })
  const processed: string[] = []

  for (const lt of leaveTypes) {
    if (lt.maxCarryForward <= 0) continue

    for (const user of users) {
      // Check if new year balance already created (idempotent)
      const existingNew = await prisma.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: user.id, leaveTypeId: lt.id, year: newYear } },
      })
      if (existingNew) continue

      const prevBalance = await prisma.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: user.id, leaveTypeId: lt.id, year: prevYear } },
      })
      if (!prevBalance) continue

      const carry = Math.min(prevBalance.balance, lt.maxCarryForward)

      await prisma.leaveBalance.create({
        data: {
          userId: user.id,
          leaveTypeId: lt.id,
          year: newYear,
          opening: carry,
          carryForward: carry,
          accrued: 0,
          taken: 0,
          adjusted: 0,
          encashed: 0,
          balance: carry,
        },
      })
      processed.push(`${user.id}:${lt.code}`)
    }
  }

  if (processed.length === 0) return []
  return [{
    entityType: 'System', entityId: `carry_forward_${newYear}`, tierKey: 'carry_forward',
    severity: 'info' as const,
    title: `Leave carry-forward processed for FY ${newYear}`,
    message: `${processed.length} leave balances carried forward from FY ${prevYear} to ${newYear} (capped at maxCarryForward per leave type).`,
  }]
})

// unapproved_expenses_stale: expenses with no linked entity approval trail, older than X days
// Note: Expense model has no approval workflow fields — this treats "unapproved" as
// entityId-less/orphan expenses (not yet attributed to a project/department) sitting stale.
registerRule('unapproved_expenses_stale', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const staleDays = (config.staleDays as number | undefined) ?? 14
  const cutoff = new Date(Date.now() - staleDays * 86400_000)
  const expenses = await prisma.expense.findMany({
    where: { entityId: null, date: { lte: cutoff } },
  })
  return expenses.map(e => ({
    entityType: 'Expense', entityId: e.id, tierKey: `unapproved_${staleDays}`,
    severity: 'warning' as const,
    title: `Unattributed expense pending review: ${e.title}`,
    message: `Expense "${e.title}" (₹${e.amount.toLocaleString()}, ${e.category}) has had no project/entity attribution for ${staleDays}+ days.`,
  }))
})

// ── Project Intelligence (remaining) ────────────────────────────────────────

// project_due_low_completion: project due within X days but below Y% complete
registerRule('project_due_low_completion', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const dueDays = (config.dueDays as number | undefined) ?? 14
  const minCompletion = (config.minCompletion as number | undefined) ?? 80
  const now = new Date()
  const cutoff = new Date(now.getTime() + dueDays * 86400_000)
  const projects = await prisma.project.findMany({
    where: {
      isActive: true, status: { notIn: ['Completed', 'Cancelled'] },
      endDate: { lte: cutoff, gte: now }, progress: { lt: minCompletion },
    },
  })
  return projects.map(p => ({
    entityType: 'Project', entityId: p.id, tierKey: `due_low_completion_${dueDays}`,
    severity: 'critical' as const,
    title: `Due soon, low completion: ${p.title}`,
    message: `${p.title} is due within ${dueDays} days but only ${p.progress ?? 0}% complete.`,
  }))
})

// project_idle_approvals: project blocked because its material requests are stuck pending
registerRule('project_idle_approvals', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const pendingHours = (config.pendingHours as number | undefined) ?? 72
  const cutoff = new Date(Date.now() - pendingHours * 3600_000)
  const mrs = await prisma.materialRequest.findMany({
    where: { status: { in: ['pending', 'partial_approved'] }, createdAt: { lte: cutoff }, projectId: { not: null } },
    include: { project: { select: { id: true, title: true, isActive: true } } },
  })
  const out: RuleTrigger[] = []
  const seen = new Set<string>()
  for (const mr of mrs) {
    if (!mr.project?.isActive || seen.has(mr.project.id)) continue
    seen.add(mr.project.id)
    out.push({
      entityType: 'Project', entityId: mr.project.id, tierKey: `idle_approvals_${pendingHours}h`,
      severity: 'warning',
      title: `Project idle on approvals: ${mr.project.title}`,
      message: `${mr.project.title} has material requests pending approval for over ${Math.floor(pendingHours / 24)} day(s).`,
    })
  }
  return out
})

// project_blocked_procurement: project has POs stuck in Draft/Approved past expected delivery
registerRule('project_blocked_procurement', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const overdueHours = (config.overdueHours as number | undefined) ?? 48
  const cutoff = new Date(Date.now() - overdueHours * 3600_000)
  const projects = await prisma.project.findMany({
    where: {
      isActive: true,
      purchaseOrders: { some: { status: { in: ['Draft', 'Approved'] }, expectedDelivery: { lte: cutoff } } },
    },
    select: { id: true, title: true },
  })
  return projects.map(project => ({
    entityType: 'Project', entityId: project.id, tierKey: `blocked_procurement_${overdueHours}h`,
    severity: 'critical' as const,
    title: `Project blocked by procurement: ${project.title}`,
    message: `${project.title} has purchase orders overdue for delivery, blocking progress.`,
  }))
})

// ── Procurement & Inventory (remaining) ─────────────────────────────────────

// goods_receipt_delayed: PO delivered but no GoodsReceipt logged within configurable window
registerRule('goods_receipt_delayed', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const graceHours = (config.graceHours as number | undefined) ?? 48
  const cutoff = new Date(Date.now() - graceHours * 3600_000)
  const pos = await prisma.purchaseOrder.findMany({
    where: { status: 'Delivered', deliveredAt: { lte: cutoff }, goodsReceipts: { none: {} } },
  })
  return pos.map(po => ({
    entityType: 'PurchaseOrder', entityId: po.id, tierKey: `receipt_delayed_${graceHours}h`,
    severity: 'warning' as const,
    title: `Goods receipt delayed: ${po.refNumber}`,
    message: `PO ${po.refNumber} (${po.supplierName}) was delivered but no goods receipt logged for ${Math.floor(graceHours / 24)}+ day(s).`,
  }))
})

// vendor_delivery_overdue: PO past expectedDelivery, not yet delivered
registerRule('vendor_delivery_overdue', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const graceHours = (config.graceHours as number | undefined) ?? 24
  const cutoff = new Date(Date.now() - graceHours * 3600_000)
  const pos = await prisma.purchaseOrder.findMany({
    where: { status: { in: ['Approved', 'Sent'] }, expectedDelivery: { lte: cutoff }, deliveredAt: null },
  })
  return pos.map(po => ({
    entityType: 'PurchaseOrder', entityId: po.id, tierKey: `delivery_overdue_${graceHours}h`,
    severity: 'warning' as const,
    title: `Vendor delivery overdue: ${po.supplierName}`,
    message: `PO ${po.refNumber} from ${po.supplierName} is overdue for delivery.`,
  }))
})

// vendor_performance_low: supplier's on-time delivery rate below threshold (trailing window)
registerRule('vendor_performance_low', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const minOnTimePercent = (config.minOnTimePercent as number | undefined) ?? 70
  const windowDays = (config.windowDays as number | undefined) ?? 90
  const minSampleSize = (config.minSampleSize as number | undefined) ?? 3
  const since = new Date(Date.now() - windowDays * 86400_000)
  const pos = await prisma.purchaseOrder.findMany({
    where: { deliveredAt: { gte: since, not: null }, expectedDelivery: { not: null } },
  })
  const bySupplier = new Map<string, { onTime: number; total: number }>()
  for (const po of pos) {
    if (!po.deliveredAt || !po.expectedDelivery) continue
    const rec = bySupplier.get(po.supplierName) ?? { onTime: 0, total: 0 }
    rec.total += 1
    if (po.deliveredAt <= po.expectedDelivery) rec.onTime += 1
    bySupplier.set(po.supplierName, rec)
  }
  const out: RuleTrigger[] = []
  for (const [supplier, rec] of bySupplier) {
    if (rec.total < minSampleSize) continue
    const pct = (rec.onTime / rec.total) * 100
    if (pct >= minOnTimePercent) continue
    out.push({
      entityType: 'Dealer', entityId: `vendor_${supplier}`, tierKey: `perf_${Math.floor(pct / 10) * 10}`,
      severity: pct < minOnTimePercent / 2 ? 'critical' : 'warning',
      title: `Vendor performance low: ${supplier}`,
      message: `${supplier} delivered on time ${Math.round(pct)}% of the last ${rec.total} orders (below ${minOnTimePercent}% threshold).`,
    })
  }
  return out
})

// dead_stock: component received long ago with zero consumption ever
registerRule('dead_stock', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const deadDays = (config.deadDays as number | undefined) ?? 180
  const cutoff = new Date(Date.now() - deadDays * 86400_000)
  const components = await prisma.rawComponent.findMany({
    where: { status: 'in_stock', receivedAt: { lte: cutoff }, materialConsumptions: { none: {} } },
  })
  return components.map(c => ({
    entityType: 'RawComponent', entityId: c.id, tierKey: `dead_${deadDays}`,
    severity: 'info' as const,
    title: `Dead stock: ${c.name}`,
    message: `${c.name} (${c.refNumber}) has sat unused in stock for ${deadDays}+ days since receipt.`,
  }))
})

// overstock: quantity far above configurable ceiling with negligible recent consumption
registerRule('overstock', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const quantityCeiling = (config.quantityCeiling as number | undefined) ?? 200
  const recentDays = (config.recentDays as number | undefined) ?? 60
  const since = new Date(Date.now() - recentDays * 86400_000)
  const components = await prisma.rawComponent.findMany({
    where: { status: 'in_stock', quantity: { gte: quantityCeiling } },
    include: { materialConsumptions: { where: { consumedAt: { gte: since } } } },
  })
  const out: RuleTrigger[] = []
  for (const c of components) {
    const recentConsumed = c.materialConsumptions.reduce((s, m) => s + m.quantity, 0)
    if (recentConsumed > (c.quantity ?? 0) * 0.1) continue
    out.push({
      entityType: 'RawComponent', entityId: c.id, tierKey: `overstock_${quantityCeiling}`,
      severity: 'info',
      title: `Overstock: ${c.name}`,
      message: `${c.name} (${c.refNumber}) has ${c.quantity} units on hand with minimal consumption in the last ${recentDays} days.`,
    })
  }
  return out
})

// material_reserved_exceeds_available: sum of allocations for a component exceeds its quantity
registerRule('material_reserved_exceeds_available', async (): Promise<RuleTrigger[]> => {
  const components = await prisma.rawComponent.findMany({
    where: { status: 'in_stock' },
    include: { inventoryAllocations: true },
  })
  const out: RuleTrigger[] = []
  for (const c of components) {
    const reserved = c.inventoryAllocations.reduce((s, a) => s + a.quantity, 0)
    if (reserved <= (c.quantity ?? 0)) continue
    out.push({
      entityType: 'RawComponent', entityId: c.id, tierKey: 'reserved_exceeds_available',
      severity: 'critical',
      title: `Over-reserved: ${c.name}`,
      message: `${c.name} (${c.refNumber}) has ${reserved} units reserved but only ${c.quantity} available.`,
    })
  }
  return out
})

// ── Service ──────────────────────────────────────────────────────────────

// sla_breach: service requests approaching or past their slaDeadline
registerRule('sla_breach', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const warnHours = (config.warnHours as number | undefined) ?? 4
  const now = new Date()
  const warnCutoff = new Date(now.getTime() + warnHours * 3600_000)
  const requests = await prisma.serviceRequest.findMany({
    where: { status: { notIn: ['Resolved', 'Closed'] as any }, slaDeadline: { lte: warnCutoff } },
  })
  const out: RuleTrigger[] = []
  for (const r of requests) {
    if (!r.slaDeadline) continue
    const breached = r.slaDeadline < now
    out.push({
      entityType: 'ServiceRequest', entityId: r.id, tierKey: breached ? 'breached' : 'approaching',
      severity: breached ? 'critical' : 'warning',
      title: breached ? `SLA breached: ${r.title}` : `SLA about to breach: ${r.title}`,
      message: breached
        ? `Service request ${r.refNumber} breached its SLA deadline.`
        : `Service request ${r.refNumber} is within ${warnHours}h of its SLA deadline.`,
    })
  }
  return out
})

// warranty_amc_expiring: ServiceRecord warrantyEnd or amcEnd within configurable window
registerRule('warranty_amc_expiring', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const warnDays = (config.warnDays as number | undefined) ?? 30
  const now = new Date()
  const cutoff = new Date(now.getTime() + warnDays * 86400_000)
  const records = await prisma.serviceRecord.findMany({
    where: {
      OR: [
        { warrantyEnd: { lte: cutoff, gte: now } },
        { amcEnd: { lte: cutoff, gte: now } },
      ],
    },
  })
  const out: RuleTrigger[] = []
  for (const r of records) {
    if (r.warrantyEnd && r.warrantyEnd <= cutoff && r.warrantyEnd >= now) {
      out.push({
        entityType: 'ServiceRecord', entityId: r.id, tierKey: 'warranty_expiring',
        severity: 'info',
        title: `Warranty expiring: ${r.productDescription ?? r.id}`,
        message: `Warranty for ${r.productDescription ?? 'service record'} expires ${r.warrantyEnd.toLocaleDateString('en-IN')}.`,
      })
    }
    if (r.amcEnd && r.amcEnd <= cutoff && r.amcEnd >= now) {
      out.push({
        entityType: 'ServiceRecord', entityId: r.id, tierKey: 'amc_expiring',
        severity: 'warning',
        title: `AMC expiring: ${r.productDescription ?? r.id}`,
        message: `AMC for ${r.productDescription ?? 'service record'} expires ${r.amcEnd.toLocaleDateString('en-IN')}.`,
      })
    }
  }
  return out
})

// repeat_complaints: service record with multiple complaint-type requests within a window
registerRule('repeat_complaints', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const windowDays = (config.windowDays as number | undefined) ?? 90
  const minCount = (config.minCount as number | undefined) ?? 3
  const since = new Date(Date.now() - windowDays * 86400_000)
  const requests = await prisma.serviceRequest.findMany({
    where: { type: 'complaint', createdAt: { gte: since } },
    include: { serviceRecord: { select: { id: true, productDescription: true } } },
  })
  const byRecord = new Map<string, { count: number; label: string }>()
  for (const r of requests) {
    const rec = byRecord.get(r.serviceRecordId) ?? { count: 0, label: r.serviceRecord.productDescription ?? r.serviceRecordId }
    rec.count += 1
    byRecord.set(r.serviceRecordId, rec)
  }
  const out: RuleTrigger[] = []
  for (const [recordId, rec] of byRecord) {
    if (rec.count < minCount) continue
    out.push({
      entityType: 'ServiceRecord', entityId: recordId, tierKey: `repeat_${minCount}`,
      severity: 'warning',
      title: `Repeat complaints: ${rec.label}`,
      message: `${rec.label} has had ${rec.count} complaints in the last ${windowDays} days.`,
    })
  }
  return out
})

// high_priority_ticket_idle: high-priority service request with no engineer acceptance for X hours
registerRule('high_priority_ticket_idle', async (config: RuleConfig): Promise<RuleTrigger[]> => {
  const idleHours = (config.idleHours as number | undefined) ?? 4
  const cutoff = new Date(Date.now() - idleHours * 3600_000)
  const requests = await prisma.serviceRequest.findMany({
    where: {
      priority: { in: ['High', 'Urgent'] },
      status: { notIn: ['Resolved', 'Closed'] as any },
      createdAt: { lte: cutoff },
      OR: [{ engineerId: null }, { engineerAcceptedAt: null }],
    },
  })
  return requests.map(r => ({
    entityType: 'ServiceRequest', entityId: r.id, tierKey: `idle_${idleHours}h`,
    severity: 'critical' as const,
    title: `High-priority ticket idle: ${r.title}`,
    message: `${r.priority}-priority ticket ${r.refNumber} has been unassigned/unaccepted for ${idleHours}+ hours.`,
  }))
})

export const RULE_KEYS = [
  'project_budget_tier', 'project_budget_progress_mismatch', 'project_stale_update',
  'invoice_overdue', 'stock_level', 'material_request_pending', 'po_pending_approval',
  'revenue_vs_target', 'expense_exceeds_budget', 'project_profit_margin_low',
  'customer_payment_overdue', 'vendor_payment_overdue', 'cash_flow_low',
  'large_invoice_generated', 'high_value_payment_received', 'unapproved_expenses_stale',
  'project_due_low_completion', 'project_idle_approvals', 'project_blocked_procurement',
  'goods_receipt_delayed', 'po_cost_exceeds_estimate', 'vendor_delivery_overdue',
  'vendor_performance_low', 'dead_stock', 'overstock', 'material_reserved_exceeds_available',
  'sla_breach', 'warranty_amc_expiring', 'repeat_complaints', 'high_priority_ticket_idle',
] as const
