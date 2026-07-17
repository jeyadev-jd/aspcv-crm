import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission, resolvePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { activeFilter, enforceActiveOr404, rejectIfInactive } from '../lib/softDelete'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const contactSchema = z.object({
  name: z.string().min(1),
  designation: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  whatsapp: z.string().optional(),
  isPrimary: z.boolean().optional(),
})

const dealerSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  gstNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  contacts: z.array(contactSchema).optional(),
})

const INCLUDE = { contacts: { orderBy: { isPrimary: 'desc' as const } } }

router.get('/', requirePermission('dealer', 'read_all'), async (req: AuthRequest, res) => {
  const { q, includeInactive } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'name')
  const searchTerm = q || pagination.search
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'dealer', 'delete')
  const where = {
    ...activeFilter(includeInactive === 'true' && canManage),
    ...(searchTerm && { name: { contains: searchTerm, mode: 'insensitive' as const } }),
  }
  const [dealers, total] = await Promise.all([
    prisma.dealer.findMany({
      where,
      include: INCLUDE,
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.dealer.count({ where }),
  ])
  res.json(paginate(dealers, total, pagination))
})

router.get('/:id', requirePermission('dealer', 'read_all'), async (req: AuthRequest, res) => {
  const { includeInactive } = req.query as Record<string, string>
  const canManage = await resolvePermission(req.user!.id, req.user!.roleName, 'dealer', 'delete')
  const dealer = await prisma.dealer.findUnique({ where: { id: req.params.id as string }, include: INCLUDE })
  if (!enforceActiveOr404(dealer, includeInactive === 'true' && canManage, res)) return
  res.json(dealer)
})

router.post('/', requirePermission('dealer', 'create'), async (req: AuthRequest, res) => {
  const data = dealerSchema.parse(req.body)
  const { contacts, ...rest } = data
  const dealer = await prisma.dealer.create({
    data: {
      ...rest,
      createdById: req.user!.id,
      contacts: contacts?.length ? { create: contacts } : undefined,
    },
    include: INCLUDE,
  })
  res.status(201).json(dealer)
})

router.put('/:id', requirePermission('dealer', 'edit'), async (req, res) => {
  const existing = await prisma.dealer.findUnique({ where: { id: req.params.id as string } })
  if (!rejectIfInactive(existing, res)) return
  const data = dealerSchema.partial().parse(req.body)
  const { contacts, ...rest } = data
  if (contacts) {
    // replace-all contacts (they lack stable IDs from the form)
    await prisma.dealerContact.deleteMany({ where: { dealerId: req.params.id as string } })
  }
  const dealer = await prisma.dealer.update({
    where: { id: req.params.id as string },
    data: {
      ...rest,
      ...(contacts ? { contacts: { create: contacts } } : {}),
    },
    include: INCLUDE,
  })
  res.json(dealer)
})

router.delete('/:id', requirePermission('dealer', 'delete'), async (req, res) => {
  const existing = await prisma.dealer.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.isActive === false) { res.status(204).end(); return } // idempotent
  await prisma.dealer.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

router.post('/:id/restore', requirePermission('dealer', 'delete'), async (req, res) => {
  const existing = await prisma.dealer.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const dealer = await prisma.dealer.update({ where: { id: req.params.id as string }, data: { isActive: true }, include: INCLUDE })
  res.json(dealer)
})

// ── Dealer Items ──────────────────────────────────────────────────────────────
const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  specification: z.string().optional(),
  unit: z.string().optional(),
  quantity: z.number().optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
  partNumber: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  inStock: z.boolean().optional(),
  notes: z.string().optional(),
})

router.get('/:id/items', requirePermission('dealer_item', 'read_all'), async (req, res) => {
  const items = await prisma.dealerItem.findMany({
    where: { dealerId: req.params.id as string },
    orderBy: { name: 'asc' },
  })
  res.json(items)
})

router.post('/:id/items', requirePermission('dealer_item', 'create'), async (req: AuthRequest, res) => {
  const data = itemSchema.parse(req.body)
  const item = await prisma.dealerItem.create({
    data: { ...data, dealerId: req.params.id as string },
  })
  res.status(201).json(item)
})

router.put('/:dealerId/items/:itemId', requirePermission('dealer_item', 'edit'), async (req, res) => {
  const data = itemSchema.partial().parse(req.body)
  const item = await prisma.dealerItem.update({
    where: { id: req.params.itemId as string },
    data,
  })
  res.json(item)
})

router.delete('/:dealerId/items/:itemId', requirePermission('dealer_item', 'delete'), async (req, res) => {
  await prisma.dealerItem.delete({ where: { id: req.params.itemId as string } })
  res.status(204).end()
})

export default router
