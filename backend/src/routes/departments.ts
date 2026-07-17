import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = createSafeRouter()
router.use(authenticate)

router.get('/', async (_req, res) => {
  const departments = await prisma.department.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })
  res.json(departments)
})

router.post('/', requirePermission('hr_user', 'edit'), async (req, res) => {
  const { name } = req.body as { name: string }
  if (!name?.trim()) { res.status(400).json({ error: 'Name required' }); return }
  const department = await prisma.department.upsert({
    where: { name: name.trim() },
    update: { isActive: true },
    create: { name: name.trim() },
  })
  res.status(201).json(department)
})

router.delete('/:id', requirePermission('hr_user', 'edit'), async (req, res) => {
  const existing = await prisma.department.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.isActive === false) { res.status(204).end(); return } // idempotent
  await prisma.department.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

router.post('/:id/restore', requirePermission('hr_user', 'edit'), async (req, res) => {
  const existing = await prisma.department.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  const department = await prisma.department.update({ where: { id: req.params.id as string }, data: { isActive: true } })
  res.json(department)
})

router.get('/:id/members', async (req, res) => {
  const members = await prisma.user.findMany({
    where: { departmentId: req.params.id as string, isActive: true },
    select: { id: true, name: true, email: true, role: true, roleName: true },
  })
  res.json(members)
})

export default router
