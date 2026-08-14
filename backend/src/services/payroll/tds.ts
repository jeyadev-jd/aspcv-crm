/**
 * TDS under the new regime (u/s 115BAC), FY 2024-25 slabs.
 *
 * Lifted verbatim out of routes/salary.ts so the payroll engine and the legacy
 * salary route share one implementation rather than drifting apart. Behaviour
 * is unchanged - routes/salary.ts now imports from here.
 */

export const STANDARD_DEDUCTION = 75000
export const REBATE_87A_LIMIT = 700000
export const REBATE_87A_MAX = 25000

/** Returns the monthly TDS for a given annual gross. */
export function calcTDS(annualGross: number): number {
  const taxable = Math.max(0, annualGross - STANDARD_DEDUCTION)
  let tax = 0
  if (taxable <= 300000) tax = 0
  else if (taxable <= 700000) tax = (taxable - 300000) * 0.05
  else if (taxable <= 1000000) tax = 20000 + (taxable - 700000) * 0.1
  else if (taxable <= 1200000) tax = 50000 + (taxable - 1000000) * 0.15
  else if (taxable <= 1500000) tax = 80000 + (taxable - 1200000) * 0.2
  else tax = 140000 + (taxable - 1500000) * 0.3

  // Section 87A rebate: taxable income up to 7L pays no tax. Applied before
  // cess, and capped so it can never turn the liability negative.
  if (taxable <= REBATE_87A_LIMIT) tax = Math.max(0, tax - Math.min(REBATE_87A_MAX, tax))

  // 4% health & education cess
  tax = tax * 1.04
  return Math.round(tax / 12)
}
