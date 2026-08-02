/**
 * Encrypt PII (PAN, bank account, IFSC) that was written while ENCRYPTION_KEY_HEX was unset.
 *
 *   npx ts-node --transpile-only src/scripts/backfill-encrypt-pii.ts          # dry run
 *   npx ts-node --transpile-only src/scripts/backfill-encrypt-pii.ts --apply  # write
 *
 * Safe to re-run: rows already in "iv:tag:ciphertext" form are skipped, so a
 * partial run can simply be repeated rather than unpicked.
 *
 * IRREVERSIBLE. Once a row is encrypted, the ONLY way to read it is with the
 * exact ENCRYPTION_KEY_HEX used here. If that key is lost or changed, the data
 * is gone. --apply therefore refuses to run without a fresh backup on disk.
 */
import prisma from '../lib/prisma'
import { encrypt, decrypt, isEncrypted } from '../lib/encrypt'
import fs from 'fs'
import path from 'path'

const APPLY = process.argv.includes('--apply')

/** Encrypt one field, verifying it round-trips before it is considered good. */
function seal(plain: string): string {
  const sealed = encrypt(plain)
  if (decrypt(sealed) !== plain) {
    throw new Error('Round-trip check failed - refusing to write unverifiable ciphertext')
  }
  return sealed
}

function assertRecentBackup() {
  const dir = path.join(__dirname, '..', '..', 'backups')
  if (!fs.existsSync(dir)) {
    throw new Error('No backups/ directory. Run: npm run db:backup pre-encryption')
  }
  const dumps = fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.sql.gz'))
    .map(f => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)

  if (dumps.length === 0) {
    throw new Error('No .sql.gz backup found. Run: npm run db:backup pre-encryption')
  }
  const ageHours = (Date.now() - dumps[0].mtime) / 3_600_000
  if (ageHours > 24) {
    throw new Error(
      `Newest backup (${dumps[0].f}) is ${ageHours.toFixed(1)}h old. ` +
        'Take a fresh one first: npm run db:backup pre-encryption',
    )
  }
  console.log(`Backup OK: ${dumps[0].f} (${ageHours.toFixed(1)}h old)\n`)
}

async function main() {
  if (!process.env.ENCRYPTION_KEY_HEX) {
    throw new Error('ENCRYPTION_KEY_HEX is not set - nothing to encrypt with.')
  }
  console.log(APPLY ? '=== APPLY (writing changes) ===\n' : '=== DRY RUN (no changes) ===\n')
  if (APPLY) assertRecentBackup()

  // pan is encrypted on write and decrypted on read in routes/users.ts, so it
  // needs the same backfill as the bank fields.
  const users = await prisma.user.findMany({
    where: { OR: [{ bankAccount: { not: null } }, { ifsc: { not: null } }, { pan: { not: null } }] },
    select: { id: true, name: true, bankAccount: true, ifsc: true, pan: true },
  })

  let changed = 0
  let skipped = 0

  for (const u of users) {
    const patch: { bankAccount?: string; ifsc?: string; pan?: string } = {}

    if (u.bankAccount && !isEncrypted(u.bankAccount)) patch.bankAccount = seal(u.bankAccount)
    if (u.ifsc && !isEncrypted(u.ifsc)) patch.ifsc = seal(u.ifsc)
    if (u.pan && !isEncrypted(u.pan)) patch.pan = seal(u.pan)

    if (Object.keys(patch).length === 0) {
      skipped++
      continue
    }

    // Never log the plaintext itself - that just moves the exposure to the
    // terminal scrollback and any CI log capturing it.
    console.log(
      `${APPLY ? 'encrypt' : 'would encrypt'}: user ${u.id} (${u.name}) ` +
        `[${Object.keys(patch).join(', ')}]`,
    )

    if (APPLY) await prisma.user.update({ where: { id: u.id }, data: patch })
    changed++
  }

  const accounts = await prisma.bankAccount.findMany({
    select: { id: true, bankName: true, accountNumber: true, ifscCode: true },
  })
  for (const a of accounts) {
    const patch: { accountNumber?: string; ifscCode?: string } = {}
    if (a.accountNumber && !isEncrypted(a.accountNumber)) patch.accountNumber = seal(a.accountNumber)
    if (a.ifscCode && !isEncrypted(a.ifscCode)) patch.ifscCode = seal(a.ifscCode)

    if (Object.keys(patch).length === 0) {
      skipped++
      continue
    }
    console.log(
      `${APPLY ? 'encrypt' : 'would encrypt'}: bankAccount ${a.id} (${a.bankName}) ` +
        `[${Object.keys(patch).join(', ')}]`,
    )
    if (APPLY) await prisma.bankAccount.update({ where: { id: a.id }, data: patch })
    changed++
  }

  console.log(
    `\n${APPLY ? 'Encrypted' : 'Would encrypt'} ${changed} row(s); ` +
      `${skipped} already encrypted or empty.`,
  )
  if (!APPLY && changed > 0) console.log('Re-run with --apply to write.')

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error('\nFAILED:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
