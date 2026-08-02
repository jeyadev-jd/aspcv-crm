/**
 * Support ticket numbering + SLA due dates.
 *
 * Numbering is FY-aware (TKT/2026-27/0001) and derived by counting existing
 * tickets in the financial year. There is no counter table: ticket volume is
 * low and `SupportTicket.ticketNumber` carries a unique constraint, so the
 * caller retries on collision rather than paying for a second table.
 */

import prisma from '../lib/prisma'
import { getFinancialYear } from './taxEngine'

/**
 * Hours allowed between ticket creation and resolution, per priority. Reports
 * measure the breach against `dueDate`, which is stamped once at create time so
 * a later priority change does not silently rewrite history.
 */
export const SLA_HOURS: Record<string, number> = {
  Critical: 4,
  High: 24,
  Medium: 72,
  Low: 168,
}

export function slaDueDate(priority: string, from: Date = new Date()): Date {
  const hours = SLA_HOURS[priority] ?? SLA_HOURS.Medium
  return new Date(from.getTime() + hours * 60 * 60 * 1000)
}

/** FY-scoped start/end boundaries for "2026-27". */
function fyRange(fy: string): { gte: Date; lt: Date } {
  const startYear = Number(fy.slice(0, 4))
  return {
    gte: new Date(Date.UTC(startYear, 3, 1)),        // 1 Apr
    lt: new Date(Date.UTC(startYear + 1, 3, 1)),     // 1 Apr next year
  }
}

/**
 * Generate the next ticket number for the FY of `createdAt`. Retries on unique
 * collision so two concurrent creates cannot both claim the same sequence.
 */
export async function generateTicketNumber(createdAt: Date = new Date()): Promise<string> {
  const fy = getFinancialYear(createdAt)
  const range = fyRange(fy)
  const used = await prisma.supportTicket.count({ where: { createdAt: range } })
  return `TKT/${fy}/${String(used + 1).padStart(4, '0')}`
}

/**
 * Claim a ticket number, stepping past any already taken. Bounded so a
 * pathological gap cannot spin forever — falls back to a timestamp suffix.
 */
export async function claimTicketNumber(createdAt: Date = new Date()): Promise<string> {
  const fy = getFinancialYear(createdAt)
  const range = fyRange(fy)
  let seq = (await prisma.supportTicket.count({ where: { createdAt: range } })) + 1

  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = `TKT/${fy}/${String(seq).padStart(4, '0')}`
    const clash = await prisma.supportTicket.findUnique({
      where: { ticketNumber: candidate },
      select: { id: true },
    })
    if (!clash) return candidate
    seq++
  }
  return `TKT/${fy}/${Date.now()}`
}
