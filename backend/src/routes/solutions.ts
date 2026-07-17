import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { createMasterDataRouter } from '../lib/masterDataRouter'

const router = createSafeRouter()
router.use(authenticate)

// Simple master-data sub-resources (mirror the flat pattern exactly)
router.use('/categories', createMasterDataRouter(prisma.solutionCategory, 'lead'))
router.use('/accessories', createMasterDataRouter(prisma.solutionAccessory, 'lead'))

// Solution — Category > Model, needs categoryId on create/list-filter, so not the flat factory shape.
router.get('/', async (req, res) => {
  const { categoryId } = req.query as Record<string, string>
  const rows = await prisma.solution.findMany({
    where: { isActive: true, ...(categoryId && { categoryId }) },
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
  res.json(rows)
})

router.post('/', requirePermission('lead', 'edit'), async (req, res) => {
  const { categoryId, name, code, description, displayOrder } = req.body as { categoryId: string; name: string; code?: string; description?: string; displayOrder?: number }
  if (!categoryId || !name?.trim()) { res.status(400).json({ error: 'categoryId and name required' }); return }
  const row = await prisma.solution.upsert({
    where: { categoryId_name: { categoryId, name: name.trim() } },
    update: { isActive: true, code, description, ...(displayOrder !== undefined && { displayOrder }) },
    create: { categoryId, name: name.trim(), code, description, displayOrder: displayOrder ?? 0 },
    include: { category: { select: { id: true, name: true } } },
  })
  res.status(201).json(row)
})

router.delete('/:id', requirePermission('lead', 'edit'), async (req, res) => {
  const existing = await prisma.solution.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  await prisma.solution.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

export default router
