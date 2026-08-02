import prisma from '../lib/prisma'

// Company policy rates. Fuel is paid per kilometre by vehicle class, never as a
// free-typed amount, so a claim can be recomputed and checked server-side.
export const FUEL_RATE_PER_KM: Record<string, number> = {
  '2-wheeler': 4,
  '4-wheeler': 8,
}

// Out-of-station food is capped per day; in-station food is not reimbursable.
export const FOOD_DAILY_CAP = 500

export type ReimbursementInput = {
  typeCode: string
  amount: number
  expenseDate: Date
  fuelVehicleType?: string | null
  distanceKm?: number | null
  isOutOfStation?: boolean
}

export type RuleResult =
  | { ok: true; amount: number; status: 'Submitted' | 'PendingManagementApproval' }
  | { ok: false; error: string }

function normalizeType(typeCode: string): 'fuel' | 'food' | 'medical' | 'other' {
  const t = typeCode.toLowerCase()
  if (t.includes('fuel') || t.includes('travel') || t.includes('mileage')) return 'fuel'
  if (t.includes('food') || t.includes('meal')) return 'food'
  if (t.includes('medical') || t.includes('health')) return 'medical'
  return 'other'
}

/**
 * Applies the hard-coded spend policy to a claim. Returns the amount the system
 * will actually record (which may differ from what the user typed, for fuel) and
 * the status the claim should enter.
 */
export async function applyReimbursementRules(input: ReimbursementInput): Promise<RuleResult> {
  const kind = normalizeType(input.typeCode)

  if (kind === 'fuel') {
    const rate = FUEL_RATE_PER_KM[input.fuelVehicleType ?? '']
    if (!rate) {
      return { ok: false, error: 'fuelVehicleType must be "2-wheeler" or "4-wheeler" for fuel claims' }
    }
    const km = Number(input.distanceKm ?? 0)
    if (!Number.isFinite(km) || km <= 0) {
      return { ok: false, error: 'distanceKm must be a positive number for fuel claims' }
    }
    // Rate × distance is authoritative — the typed amount is only a hint.
    return { ok: true, amount: Math.round(km * rate * 100) / 100, status: 'Submitted' }
  }

  if (kind === 'food') {
    if (!input.isOutOfStation) {
      return { ok: false, error: 'Food is only reimbursable for out-of-station travel' }
    }
    if (input.amount > FOOD_DAILY_CAP) {
      return { ok: false, error: `Food claims are capped at ₹${FOOD_DAILY_CAP} per day` }
    }
    return { ok: true, amount: input.amount, status: 'Submitted' }
  }

  if (kind === 'medical') {
    // Medical always skips the normal chain and goes straight to management.
    return { ok: true, amount: input.amount, status: 'PendingManagementApproval' }
  }

  return { ok: true, amount: input.amount, status: 'Submitted' }
}

/**
 * Sums an employee's already-claimed food spend for a given day so the daily cap
 * applies across multiple rows, not just per row.
 */
export async function foodSpentOnDay(userId: string, expenseDate: Date): Promise<number> {
  const dayStart = new Date(Date.UTC(
    expenseDate.getUTCFullYear(), expenseDate.getUTCMonth(), expenseDate.getUTCDate()
  ))
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const rows = await prisma.reimbursement.findMany({
    where: {
      userId,
      expenseDate: { gte: dayStart, lt: dayEnd },
      status: { notIn: ['Rejected', 'Draft'] },
    },
    select: { amount: true, typeCode: true },
  })
  return rows
    .filter(r => normalizeType(r.typeCode) === 'food')
    .reduce((sum, r) => sum + r.amount, 0)
}

export { normalizeType }
