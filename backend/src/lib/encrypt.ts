import crypto from 'crypto'

const ALGO = 'aes-256-gcm'
const KEY_HEX = process.env.ENCRYPTION_KEY_HEX || ''

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error('ENCRYPTION_KEY_HEX must be a 64-char hex string (32 bytes). Generate: openssl rand -hex 32')
  }
  return Buffer.from(KEY_HEX, 'hex')
}

// Returns "iv:authTag:ciphertext" all as hex, colon-separated
export function encrypt(plain: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`
}

export function decrypt(encoded: string): string {
  const key = getKey()
  const parts = encoded.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted value format')
  const [ivHex, tagHex, ctHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const ct = Buffer.from(ctHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

// Null-safe helpers for optional DB fields
export function encryptIfPresent(value: string | null | undefined): string | null {
  if (!value) return null
  // Deliberately no "graceful" plaintext fallback here. Silently storing bank
  // details unencrypted is worse than refusing the write: nothing surfaces the
  // failure, and every row written meanwhile has to be found and re-encrypted.
  return encrypt(value)
}

/** True when a value is in the "iv:tag:ciphertext" shape produced by encrypt(). */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false
  const parts = value.split(':')
  if (parts.length !== 3) return false
  // 12-byte IV and 16-byte auth tag, hex-encoded, are fixed widths.
  return /^[0-9a-f]{24}$/.test(parts[0]) && /^[0-9a-f]{32}$/.test(parts[1]) && /^[0-9a-f]*$/.test(parts[2])
}

export function decryptIfPresent(value: string | null | undefined): string | null {
  if (!value) return null
  // Reads stay tolerant of legacy plaintext rows written before the key existed,
  // so the app keeps working between deploying the key and running the backfill
  // (scripts/backfill-encrypt-pii.ts). Writes are strict; only reads are lenient.
  if (!isEncrypted(value)) return value
  try {
    return decrypt(value)
  } catch {
    // Wrong key or tampered ciphertext. Returning the raw blob would leak
    // ciphertext into the UI as if it were an account number.
    return null
  }
}
