import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { parsePagination, paginate } from '../lib/pagination'
import { z } from 'zod'

const router = createSafeRouter()
router.use(authenticate)

const itemSchema = z.object({
  dealerId: z.string().min(1),
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

const INCLUDE = { dealer: { select: { id: true, name: true } } }

router.get('/', requirePermission('dealer_item', 'read_all'), async (req, res) => {
  const { q, dealerId } = req.query as Record<string, string>
  const pagination = parsePagination(req.query as Record<string, unknown>, 'name')
  const searchTerm = q || pagination.search
  const where = {
    ...(dealerId && { dealerId }),
    ...(searchTerm && {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' as const } },
        { description: { contains: searchTerm, mode: 'insensitive' as const } },
        { specification: { contains: searchTerm, mode: 'insensitive' as const } },
        { brand: { contains: searchTerm, mode: 'insensitive' as const } },
        { partNumber: { contains: searchTerm, mode: 'insensitive' as const } },
        { dealer: { name: { contains: searchTerm, mode: 'insensitive' as const } } },
      ],
    }),
  }
  const [items, total] = await Promise.all([
    prisma.dealerItem.findMany({
      where,
      include: INCLUDE,
      orderBy: { [pagination.sort as string]: pagination.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.dealerItem.count({ where }),
  ])
  res.json(paginate(items, total, pagination))
})

router.get('/:id', requirePermission('dealer_item', 'read_all'), async (req, res) => {
  const item = await prisma.dealerItem.findUnique({ where: { id: req.params.id as string }, include: INCLUDE })
  if (!item) { res.status(404).json({ error: 'Not found' }); return }
  res.json(item)
})

router.post('/', requirePermission('dealer_item', 'create'), async (_req: AuthRequest, res) => {
  const data = itemSchema.parse(_req.body)
  const { dealerId, ...rest } = data
  const item = await prisma.dealerItem.create({
    data: { ...rest, dealerId },
    include: INCLUDE,
  })
  res.status(201).json(item)
})

router.put('/:id', requirePermission('dealer_item', 'edit'), async (req, res) => {
  const data = itemSchema.partial().parse(req.body)
  const item = await prisma.dealerItem.update({
    where: { id: req.params.id as string },
    data,
    include: INCLUDE,
  })
  res.json(item)
})

router.delete('/:id', requirePermission('dealer_item', 'delete'), async (req, res) => {
  await prisma.dealerItem.delete({ where: { id: req.params.id as string } })
  res.status(204).end()
})

export default router
