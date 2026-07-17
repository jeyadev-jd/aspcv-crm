import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = createSafeRouter()
router.use(authenticate)

router.get('/', async (_req, res) => {
  const industries = await prisma.industry.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })
  res.json(industries)
})

router.post('/', requirePermission('hr_user', 'edit'), async (req, res) => {
  const { name } = req.body as { name: string }
  if (!name?.trim()) { res.status(400).json({ error: 'Name required' }); return }
  const industry = await prisma.industry.upsert({
    where: { name: name.trim() },
    update: { isActive: true },
    create: { name: name.trim() },
  })
  res.status(201).json(industry)
})

router.delete('/:id', requirePermission('hr_user', 'edit'), async (req, res) => {
  const existing = await prisma.industry.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.isActive === false) { res.status(204).end(); return } // idempotent
  await prisma.industry.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

router.post('/:id/restore', requirePermission('hr_user', 'edit'), async (req, res) => {
  const existing = await prisma.industry.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const industry = await prisma.industry.update({ where: { id: req.params.id as string }, data: { isActive: true } })
  res.json(industry)
})

export default router
