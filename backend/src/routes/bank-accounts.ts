import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = createSafeRouter()
router.use(authenticate)

router.get('/', requirePermission('bank_account', 'read_all'), async (_req, res) => {
  const rows = await prisma.bankAccount.findMany({ orderBy: { createdAt: 'asc' } })
  res.json(rows)
})

router.post('/', requirePermission('bank_account', 'create'), async (req, res) => {
  const { bankName, accountNumber, ifscCode, isDefault } = req.body
  if (!bankName || !accountNumber || !ifscCode) { res.status(400).json({ error: 'bankName, accountNumber, ifscCode required' }); return }
  const row = await prisma.$transaction(async tx => {
    if (isDefault) await tx.bankAccount.updateMany({ data: { isDefault: false }, where: { isDefault: true } })
    return tx.bankAccount.create({ data: { bankName, accountNumber, ifscCode, isDefault: !!isDefault } })
  })
  res.status(201).json(row)
})

router.patch('/:id', requirePermission('bank_account', 'edit'), async (req, res) => {
  const { bankName, accountNumber, ifscCode, isDefault } = req.body
  const row = await prisma.$transaction(async tx => {
    if (isDefault) await tx.bankAccount.updateMany({ data: { isDefault: false }, where: { isDefault: true, id: { not: req.params.id as string } } })
    return tx.bankAccount.update({ where: { id: req.params.id as string }, data: { bankName, accountNumber, ifscCode, isDefault } })
  })
  res.json(row)
})

router.delete('/:id', requirePermission('bank_account', 'delete'), async (req, res) => {
  await prisma.bankAccount.delete({ where: { id: req.params.id as string } })
  res.status(204).send()
})

export default router
