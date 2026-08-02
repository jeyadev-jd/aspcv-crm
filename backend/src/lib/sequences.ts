import prisma from './prisma'

/**
 * All number generators use Postgres SEQUENCE (nextval is atomic — two
 * concurrent callers can never get the same value, unlike count()+1).
 * Sequences are created once via the security_hardening migration.
 */

async function nextSeq(seqName: string): Promise<bigint> {
  const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval(${seqName})`
  return rows[0].nextval
}

export async function nextLeadNumber(): Promise<string> {
  const seq = (await nextSeq('lead_number_seq')).toString().padStart(6, '0')
  return `LD-${new Date().getFullYear()}-${seq}`
}

export async function nextWONumber(): Promise<string> {
  const seq = (await nextSeq('wo_number_seq')).toString().padStart(4, '0')
  return `WO-${seq}`
}

export async function nextGRNumber(): Promise<string> {
  const seq = (await nextSeq('gr_number_seq')).toString().padStart(4, '0')
  return `GR-${seq}`
}

export async function nextMRNumber(): Promise<string> {
  const seq = (await nextSeq('mr_number_seq')).toString().padStart(4, '0')
  return `MR-${new Date().getFullYear()}-${seq}`
}

export async function nextInvoiceNumber(prefix: string = 'INV'): Promise<string> {
  const seq = (await nextSeq('invoice_number_seq')).toString().padStart(4, '0')
  return `${prefix}-${new Date().getFullYear()}-${seq}`
}
