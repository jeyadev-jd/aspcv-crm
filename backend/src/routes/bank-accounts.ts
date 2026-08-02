import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { encryptIfPresent, decryptIfPresent } from '../lib/encrypt'

const router = createSafeRouter()
router.use(authenticate)

type BankRow = { accountNumber: string; ifscCode: string }

/**
 * accountNumber / ifscCode are encrypted at rest. Callers (notably the invoice
 * PDF templates) need the real values, so every response is decrypted here.
 */
function decodeRow<T extends BankRow>(row: T): T {
  return { ...row, accountNumber: decryptIfPresent(row.accountNumber) ?? '', ifscCode: decryptIfPresent(row.ifscCode) ?? '' }
}

router.get('/', requirePermission('bank_account', 'read_all'), async (_req, res) => {
  const rows = await prisma.bankAccount.findMany({ orderBy: { createdAt: 'asc' } })
  res.json(rows.map(decodeRow))
})

router.post('/', requirePermission('bank_account', 'create'), async (req, res) => {
  const { bankName, accountNumber, ifscCode, isDefault } = req.body
  if (!bankName || !accountNumber || !ifscCode) { res.status(400).json({ error: 'bankName, accountNumber, ifscCode required' }); return }
  const row = await prisma.$transaction(async tx => {
    if (isDefault) await tx.bankAccount.updateMany({ data: { isDefault: false }, where: { isDefault: true } })
    return tx.bankAccount.create({
      data: {
        bankName,
        accountNumber: encryptIfPresent(accountNumber) as string,
        ifscCode: encryptIfPresent(ifscCode) as string,
        isDefault: !!isDefault,
      },
    })
  })
  res.status(201).json(decodeRow(row))
})

router.patch('/:id', requirePermission('bank_account', 'edit'), async (req, res) => {
  const { bankName, accountNumber, ifscCode, isDefault } = req.body
  const row = await prisma.$transaction(async tx => {
    if (isDefault) await tx.bankAccount.updateMany({ data: { isDefault: false }, where: { isDefault: true, id: { not: req.params.id as string } } })
    return tx.bankAccount.update({
      where: { id: req.params.id as string },
      data: {
        bankName,
        // encryptIfPresent(undefined) returns null, which Prisma would write as
        // an actual null and wipe the field. Only encrypt what was really sent.
        ...(accountNumber !== undefined ? { accountNumber: encryptIfPresent(accountNumber) as string } : {}),
        ...(ifscCode !== undefined ? { ifscCode: encryptIfPresent(ifscCode) as string } : {}),
        isDefault,
      },
    })
  })
  res.json(decodeRow(row))
})

router.delete('/:id', requirePermission('bank_account', 'delete'), async (req, res) => {
  await prisma.bankAccount.delete({ where: { id: req.params.id as string } })
  res.status(204).send()
})

export default router
