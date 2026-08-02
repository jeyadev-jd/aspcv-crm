// Indian GSTIN validation: 15-char alphanumeric
// Format: 2-digit state code + 10-char PAN + 1-digit entity + Z + 1 checksum
// State codes: 01-38 (some reserved/unused)
const VALID_STATE_CODES = new Set([
  '01','02','03','04','05','06','07','08','09','10',
  '11','12','13','14','15','16','17','18','19','20',
  '21','22','23','24','25','26','27','28','29','30',
  '31','32','33','34','35','36','37','38',
])

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

export function isValidGSTIN(gstin: string): boolean {
  if (!gstin || gstin.length !== 15) return false
  const upper = gstin.toUpperCase()
  if (!GSTIN_REGEX.test(upper)) return false
  const stateCode = upper.slice(0, 2)
  return VALID_STATE_CODES.has(stateCode)
}

export function validateGSTIN(gstin: string | null | undefined): string | null {
  if (!gstin) return null
  if (!isValidGSTIN(gstin)) {
    return `Invalid GSTIN "${gstin}" — must be 15 chars: 2-digit state code + 10-char PAN + entity + Z + checksum (e.g. 33AABCU9603R1ZX)`
  }
  return null
}
