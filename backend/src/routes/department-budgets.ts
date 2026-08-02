import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const budgetSchema = z.object({
  departmentId: z.string().min(1),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, 'Format: 2026-27'),
  category: z.enum(['Salary', 'Travel', 'Equipment', 'Training', 'Marketing', 'Other']),
  allocatedAmount: z.number().min(0),
  notes: z.string().optional(),
})

function currentFY(): string {
  const now = new Date()
  const y = now.getFullYear()
  return now.getMonth() >= 3 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`
}

// List budgets — optionally filtered by FY or departmentId
router.get('/', requirePermission('finance', 'read'), async (req, res) => {
  const { financialYear, departmentId } = req.query as Record<string, string>
  const fy = financialYear || currentFY()
  const where: any = { financialYear: fy }
  if (departmentId) where.departmentId = departmentId
  const budgets = await prisma.departmentBudget.findMany({
    where,
    include: { department: { select: { id: true, name: true } } },
    orderBy: [{ department: { name: 'asc' } }, { category: 'asc' }],
  })

  // Summary: total allocated vs spent across all departments for FY
  const totals = budgets.reduce(
    (acc, b) => ({ allocated: acc.allocated + b.allocatedAmount, spent: acc.spent + b.spentAmount }),
    { allocated: 0, spent: 0 }
  )
  res.json({ budgets, totals, financialYear: fy })
})

router.get('/variance', requirePermission('finance', 'read'), async (req, res) => {
  const fy = (req.query.financialYear as string) || currentFY()
  const budgets = await prisma.departmentBudget.findMany({
    where: { financialYear: fy },
    include: { department: { select: { id: true, name: true } } },
  })
  const variance = budgets.map(b => ({
    department: b.department.name,
    category: b.category,
    allocated: b.allocatedAmount,
    spent: b.spentAmount,
    remaining: b.allocatedAmount - b.spentAmount,
    utilizationPct: b.allocatedAmount > 0
      ? Math.round((b.spentAmount / b.allocatedAmount) * 10000) / 100
      : 0,
    overBudget: b.spentAmount > b.allocatedAmount,
  }))
  res.json({ financialYear: fy, variance })
})

router.post('/', requirePermission('finance', 'edit'), async (req: AuthRequest, res) => {
  const data = budgetSchema.parse(req.body)
  const existing = await prisma.departmentBudget.findUnique({
    where: {
      departmentId_financialYear_category: {
        departmentId: data.departmentId,
        financialYear: data.financialYear,
        category: data.category,
      },
    },
  })
  if (existing) {
    res.status(409).json({ error: `Budget for ${data.category} already exists for this department/FY` })
    return
  }
  const budget = await prisma.departmentBudget.create({
    data: { ...data, notes: data.notes ?? null, createdById: req.user?.id },
    include: { department: { select: { id: true, name: true } } },
  })
  res.status(201).json(budget)
})

router.patch('/:id', requirePermission('finance', 'edit'), async (req, res) => {
  const data = z.object({
    allocatedAmount: z.number().min(0).optional(),
    notes: z.string().optional(),
  }).parse(req.body)
  const budget = await prisma.departmentBudget.update({
    where: { id: req.params.id as string },
    data,
    include: { department: { select: { id: true, name: true } } },
  })
  res.json(budget)
})

// Increment spent amount when an expense is approved
router.post('/:id/spend', requirePermission('finance', 'edit'), async (req, res) => {
  const { amount } = z.object({ amount: z.number().positive() }).parse(req.body)
  const budget = await prisma.departmentBudget.update({
    where: { id: req.params.id as string },
    data: { spentAmount: { increment: amount } },
  })
  res.json({
    ...budget,
    overBudget: budget.spentAmount > budget.allocatedAmount,
    remaining: budget.allocatedAmount - budget.spentAmount,
  })
})

router.delete('/:id', requirePermission('finance', 'edit'), async (req, res) => {
  const existing = await prisma.departmentBudget.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.spentAmount > 0) {
    res.status(409).json({ error: 'Cannot delete budget with recorded spending' })
    return
  }
  await prisma.departmentBudget.delete({ where: { id: req.params.id as string } })
  res.status(204).end()
})

export default router
