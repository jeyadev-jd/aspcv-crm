import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
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
  await prisma.industry.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

export default router
