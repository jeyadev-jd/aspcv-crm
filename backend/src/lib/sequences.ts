import prisma from './prisma'

/**
 * Concurrency-safe sequential number generation via a real Postgres SEQUENCE
 * (nextval is atomic at the DB level — unlike the count()+1 pattern used
 * elsewhere in this codebase, two concurrent callers can never get the same
 * value). Format: LD-{year}-{6-digit sequence}. The sequence itself never
 * resets per year — only the display prefix does — so numbers stay globally
 * unique even across a year boundary with zero extra locking.
 */
export async function nextLeadNumber(): Promise<string> {
  const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('lead_number_seq')`
  const seq = rows[0].nextval.toString().padStart(6, '0')
  const year = new Date().getFullYear()
  return `LD-${year}-${seq}`
}
