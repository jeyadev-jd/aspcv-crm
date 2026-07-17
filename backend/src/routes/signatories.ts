import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = createSafeRouter()
router.use(authenticate)

router.get('/', requirePermission('signatory', 'read_all'), async (_req, res) => {
  const rows = await prisma.signatory.findMany({ orderBy: { createdAt: 'asc' } })
  res.json(rows)
})

router.post('/', requirePermission('signatory', 'create'), async (req, res) => {
  const { name, designation, signatureData, isDefault } = req.body
  if (!name) { res.status(400).json({ error: 'name required' }); return }
  const row = await prisma.$transaction(async tx => {
    if (isDefault) await tx.signatory.updateMany({ data: { isDefault: false }, where: { isDefault: true } })
    return tx.signatory.create({ data: { name, designation, signatureData, isDefault: !!isDefault } })
  })
  res.status(201).json(row)
})

router.patch('/:id', requirePermission('signatory', 'edit'), async (req, res) => {
  const { name, designation, signatureData, isDefault } = req.body
  const row = await prisma.$transaction(async tx => {
    if (isDefault) await tx.signatory.updateMany({ data: { isDefault: false }, where: { isDefault: true, id: { not: req.params.id as string } } })
    return tx.signatory.update({ where: { id: req.params.id as string }, data: { name, designation, signatureData, isDefault } })
  })
  res.json(row)
})

router.delete('/:id', requirePermission('signatory', 'delete'), async (req, res) => {
  await prisma.signatory.delete({ where: { id: req.params.id as string } })
  res.status(204).send()
})

export default router
