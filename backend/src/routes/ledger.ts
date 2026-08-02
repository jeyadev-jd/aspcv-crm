import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

// ─── Chart of Accounts ───────────────────────────────────────────────────────

const accountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']),
  subType: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().optional(),
})

router.get('/accounts', requirePermission('finance', 'read'), async (req, res) => {
  const { type } = req.query as Record<string, string>
  const where: any = { isActive: true }
  if (type) where.type = type
  const accounts = await prisma.ledgerAccount.findMany({
    where,
    orderBy: [{ type: 'asc' }, { code: 'asc' }],
    include: { parent: { select: { id: true, name: true, code: true } } },
  })
  res.json(accounts)
})

router.post('/accounts', requirePermission('finance', 'edit'), async (req: AuthRequest, res) => {
  const data = accountSchema.parse(req.body)
  const existing = await prisma.ledgerAccount.findUnique({ where: { code: data.code } })
  if (existing) { res.status(409).json({ error: `Account code ${data.code} already exists` }); return }
  const account = await prisma.ledgerAccount.create({ data: data as any })
  res.status(201).json(account)
})

router.patch('/accounts/:id', requirePermission('finance', 'edit'), async (req, res) => {
  const data = accountSchema.partial().parse(req.body)
  const account = await prisma.ledgerAccount.update({
    where: { id: req.params.id as string },
    data: data as any,
  })
  res.json(account)
})

// ─── Journal Entries ──────────────────────────────────────────────────────────

const lineSchema = z.object({
  debitAccountId: z.string().optional(),
  creditAccountId: z.string().optional(),
  amount: z.number().positive(),
  description: z.string().optional(),
})

const journalSchema = z.object({
  date: z.string(),
  description: z.string().min(1),
  reference: z.string().optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  lines: z.array(lineSchema).min(2),
})

router.get('/journal', requirePermission('finance', 'read'), async (req, res) => {
  const { sourceType, sourceId, from, to } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'date')
  const where: any = {}
  if (sourceType) where.sourceType = sourceType
  if (sourceId) where.sourceId = sourceId
  if (from || to) where.date = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) }
  const [entries, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      include: { lines: { include: { debitAccount: true, creditAccount: true } } },
      orderBy: { date: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.journalEntry.count({ where }),
  ])
  res.json(paginate(entries, total, pagination))
})

router.get('/journal/:id', requirePermission('finance', 'read'), async (req, res) => {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: req.params.id as string },
    include: { lines: { include: { debitAccount: true, creditAccount: true } } },
  })
  if (!entry) { res.status(404).json({ error: 'Not found' }); return }
  res.json(entry)
})

router.post('/journal', requirePermission('finance', 'edit'), async (req: AuthRequest, res) => {
  const data = journalSchema.parse(req.body)

  // Validate: total debits must equal total credits
  const totalDebits = data.lines.filter(l => l.debitAccountId).reduce((s, l) => s + l.amount, 0)
  const totalCredits = data.lines.filter(l => l.creditAccountId).reduce((s, l) => s + l.amount, 0)
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    res.status(400).json({ error: `Journal entry not balanced: debits ${totalDebits} ≠ credits ${totalCredits}` })
    return
  }

  const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('invoice_number_seq')`
  const entryNumber = `JE-${new Date().getFullYear()}-${rows[0].nextval.toString().padStart(5, '0')}`

  const entry = await prisma.$transaction(async tx => {
    const je = await tx.journalEntry.create({
      data: {
        entryNumber,
        date: new Date(data.date),
        description: data.description,
        reference: data.reference ?? null,
        sourceType: data.sourceType ?? null,
        sourceId: data.sourceId ?? null,
        isPosted: true,
        postedAt: new Date(),
        createdById: req.user?.id,
        lines: { create: data.lines },
      },
      include: { lines: { include: { debitAccount: true, creditAccount: true } } },
    })

    // Update running balances on ledger accounts
    for (const line of data.lines) {
      if (line.debitAccountId) {
        const acct = await tx.ledgerAccount.findUnique({ where: { id: line.debitAccountId } })
        if (acct) {
          // Assets/Expenses increase with debits; Liabilities/Equity/Revenue decrease
          const delta = ['Asset', 'Expense'].includes(acct.type) ? line.amount : -line.amount
          await tx.ledgerAccount.update({ where: { id: line.debitAccountId }, data: { balance: { increment: delta } } })
        }
      }
      if (line.creditAccountId) {
        const acct = await tx.ledgerAccount.findUnique({ where: { id: line.creditAccountId } })
        if (acct) {
          const delta = ['Liability', 'Equity', 'Revenue'].includes(acct.type) ? line.amount : -line.amount
          await tx.ledgerAccount.update({ where: { id: line.creditAccountId }, data: { balance: { increment: delta } } })
        }
      }
    }
    return je
  })
  res.status(201).json(entry)
})

// ─── Reports ─────────────────────────────────────────────────────────────────

// Trial Balance
router.get('/reports/trial-balance', requirePermission('finance', 'read'), async (req, res) => {
  const accounts = await prisma.ledgerAccount.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { code: 'asc' }],
    select: { id: true, code: true, name: true, type: true, subType: true, balance: true },
  })
  const totalDebits = accounts.filter(a => ['Asset', 'Expense'].includes(a.type)).reduce((s, a) => s + a.balance, 0)
  const totalCredits = accounts.filter(a => ['Liability', 'Equity', 'Revenue'].includes(a.type)).reduce((s, a) => s + a.balance, 0)
  res.json({
    accounts,
    totalDebits: Math.round(totalDebits * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    isBalanced: Math.abs(totalDebits - totalCredits) < 1,
  })
})

// Profit & Loss
router.get('/reports/profit-loss', requirePermission('finance', 'read'), async (req, res) => {
  const { from, to } = req.query as Record<string, string>
  const dateFilter = from || to
    ? { date: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }
    : {}

  // Get all journal lines within date range grouped by account type
  const lines = await prisma.journalEntryLine.findMany({
    where: { entry: { isPosted: true, ...dateFilter } },
    include: { debitAccount: true, creditAccount: true },
  })

  const revenue = { total: 0, accounts: new Map<string, number>() }
  const expense = { total: 0, accounts: new Map<string, number>() }

  for (const line of lines) {
    if (line.creditAccount?.type === 'Revenue') {
      const key = line.creditAccount.name
      revenue.accounts.set(key, (revenue.accounts.get(key) || 0) + line.amount)
      revenue.total += line.amount
    }
    if (line.debitAccount?.type === 'Revenue') {
      const key = line.debitAccount.name
      revenue.accounts.set(key, (revenue.accounts.get(key) || 0) - line.amount)
      revenue.total -= line.amount
    }
    if (line.debitAccount?.type === 'Expense') {
      const key = line.debitAccount.name
      expense.accounts.set(key, (expense.accounts.get(key) || 0) + line.amount)
      expense.total += line.amount
    }
    if (line.creditAccount?.type === 'Expense') {
      const key = line.creditAccount.name
      expense.accounts.set(key, (expense.accounts.get(key) || 0) - line.amount)
      expense.total -= line.amount
    }
  }

  const netProfit = revenue.total - expense.total
  res.json({
    period: { from: from || null, to: to || null },
    revenue: {
      total: Math.round(revenue.total * 100) / 100,
      breakdown: Object.fromEntries(revenue.accounts),
    },
    expense: {
      total: Math.round(expense.total * 100) / 100,
      breakdown: Object.fromEntries(expense.accounts),
    },
    netProfit: Math.round(netProfit * 100) / 100,
    grossMarginPct: revenue.total > 0 ? Math.round((netProfit / revenue.total) * 10000) / 100 : 0,
  })
})

// Balance Sheet
router.get('/reports/balance-sheet', requirePermission('finance', 'read'), async (req, res) => {
  const accounts = await prisma.ledgerAccount.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { code: 'asc' }],
  })

  const grouped: Record<string, { name: string; code: string; balance: number }[]> = {
    Asset: [], Liability: [], Equity: [], Revenue: [], Expense: [],
  }
  for (const a of accounts) {
    grouped[a.type]?.push({ name: a.name, code: a.code, balance: a.balance })
  }

  const totalAssets = grouped.Asset.reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = grouped.Liability.reduce((s, a) => s + a.balance, 0)
  const totalEquity = grouped.Equity.reduce((s, a) => s + a.balance, 0)

  res.json({
    assets: { items: grouped.Asset, total: Math.round(totalAssets * 100) / 100 },
    liabilities: { items: grouped.Liability, total: Math.round(totalLiabilities * 100) / 100 },
    equity: { items: grouped.Equity, total: Math.round(totalEquity * 100) / 100 },
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
    generatedAt: new Date().toISOString(),
  })
})

// General Ledger for a specific account
router.get('/reports/ledger/:accountId', requirePermission('finance', 'read'), async (req, res) => {
  const { from, to } = req.query as Record<string, string>
  const account = await prisma.ledgerAccount.findUnique({ where: { id: req.params.accountId as string } })
  if (!account) { res.status(404).json({ error: 'Account not found' }); return }

  const dateFilter = from || to
    ? { entry: { date: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } }
    : {}

  const [debitLines, creditLines] = await Promise.all([
    prisma.journalEntryLine.findMany({
      where: { debitAccountId: account.id, entry: { isPosted: true }, ...dateFilter },
      include: { entry: { select: { entryNumber: true, date: true, description: true, reference: true } } },
      orderBy: { entry: { date: 'asc' } },
    }),
    prisma.journalEntryLine.findMany({
      where: { creditAccountId: account.id, entry: { isPosted: true }, ...dateFilter },
      include: { entry: { select: { entryNumber: true, date: true, description: true, reference: true } } },
      orderBy: { entry: { date: 'asc' } },
    }),
  ])

  // Merge and sort by date
  const movements = [
    ...debitLines.map(l => ({ ...l.entry, amount: l.amount, side: 'Dr', description: l.description || l.entry.description })),
    ...creditLines.map(l => ({ ...l.entry, amount: l.amount, side: 'Cr', description: l.description || l.entry.description })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  res.json({ account, movements, currentBalance: account.balance })
})

export default router
