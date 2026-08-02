import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { z } from 'zod'
import { validateGSTIN } from '../lib/gstin'

const router = createSafeRouter()
router.use(authenticate)

const branchSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10).toUpperCase(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  invoicePrefix: z.string().optional(),
  isHeadOffice: z.boolean().optional(),
})

router.get('/', requirePermission('settings', 'read'), async (req, res) => {
  const pagination = parsePagination(req.query as Record<string, unknown>, 'name')
  const where = { isActive: true }
  const [branches, total] = await Promise.all([
    prisma.branch.findMany({
      where,
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.branch.count({ where }),
  ])
  res.json(paginate(branches, total, pagination))
})

router.get('/:id', requirePermission('settings', 'read'), async (req, res) => {
  const branch = await prisma.branch.findUnique({ where: { id: req.params.id as string } })
  if (!branch) { res.status(404).json({ error: 'Not found' }); return }
  res.json(branch)
})

router.post('/', requirePermission('settings', 'edit'), async (req: AuthRequest, res) => {
  const data = branchSchema.parse(req.body)
  if (data.gstin) {
    const gstinErr = validateGSTIN(data.gstin)
    if (gstinErr) { res.status(400).json({ error: gstinErr }); return }
  }
  const existing = await prisma.branch.findUnique({ where: { code: data.code } })
  if (existing) { res.status(409).json({ error: `Branch code '${data.code}' already exists` }); return }
  const branch = await prisma.branch.create({ data: { ...data, email: data.email || null } })
  res.status(201).json(branch)
})

router.patch('/:id', requirePermission('settings', 'edit'), async (req: AuthRequest, res) => {
  const data = branchSchema.partial().parse(req.body)
  if (data.gstin) {
    const gstinErr = validateGSTIN(data.gstin)
    if (gstinErr) { res.status(400).json({ error: gstinErr }); return }
  }
  if (data.code) {
    const clash = await prisma.branch.findFirst({ where: { code: data.code, id: { not: req.params.id as string } } })
    if (clash) { res.status(409).json({ error: `Branch code '${data.code}' already in use` }); return }
  }
  const branch = await prisma.branch.update({
    where: { id: req.params.id as string },
    data: { ...data, email: data.email || null },
  })
  res.json(branch)
})

router.delete('/:id', requirePermission('settings', 'edit'), async (req, res) => {
  const existing = await prisma.branch.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.isHeadOffice) { res.status(409).json({ error: 'Cannot deactivate head office branch' }); return }
  await prisma.branch.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

// Generate branch-specific invoice number: PREFIX/FY/SEQ
router.get('/:id/next-invoice-number', requirePermission('invoice', 'create'), async (req, res) => {
  const branch = await prisma.branch.findUnique({ where: { id: req.params.id as string } })
  if (!branch) { res.status(404).json({ error: 'Branch not found' }); return }
  const type = (req.query.type as string) || 'INV'
  const now = new Date()
  const fy = now.getMonth() >= 3
    ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`
    : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`
  const prefix = branch.invoicePrefix || branch.code
  const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('invoice_number_seq')`
  const seq = rows[0].nextval.toString().padStart(4, '0')
  res.json({ number: `${prefix}/${fy}/${seq}`, branch: branch.code, financialYear: fy })
})

export default router
