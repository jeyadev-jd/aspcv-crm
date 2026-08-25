/**
 * Payroll formulas transcribed from `Salary Model.xlsx` (sheet "June 2026").
 *
 * Every exported function names the workbook column it implements. These are
 * deliberately pure and free of Prisma/IO so they can be unit-tested directly
 * against the spreadsheet's own sample values.
 *
 * Rates and thresholds are passed in via StatutoryRates rather than hardcoded,
 * so an approved payroll run can record exactly which configuration produced
 * its numbers.
 */

export interface StatutoryRates {
  version: string
  pfWageCeiling: number // 15000
  pfEmployeeRate: number // 0.12
  pfEmployerRate: number // 0.12
  /** xlsx AX uses a flat 1800 above the ceiling, not 12% recomputed. */
  pfCappedAmount: number // 1800
  esiWageThreshold: number // 21000
  esiEmployeeRate: number // 0.0075
  esiEmployerRate: number // 0.0325
  adminChargeRate: number // 0.005
  edliChargeRate: number // 0.005
}

export const DEFAULT_RATES: StatutoryRates = {
  version: 'xlsx-2026-06',
  pfWageCeiling: 15000,
  pfEmployeeRate: 0.12,
  pfEmployerRate: 0.12,
  pfCappedAmount: 1800,
  esiWageThreshold: 21000,
  esiEmployeeRate: 0.0075,
  esiEmployerRate: 0.0325,
  adminChargeRate: 0.005,
  edliChargeRate: 0.005,
}

/** Currency rounding to 2 decimals, avoiding float drift on .005 cases. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// ─── Master salary (xlsx U-AK) ───────────────────────────────────────────────

/**
 * xlsx U/V/W are blank data-entry cells - Basic, HRA and Others are typed in
 * per employee, and Master Gross (AA) is `=SUM(U:Z)` over them. The components
 * drive the gross, not the other way round.
 *
 * The 50/25/25 ratio is only a convenience default for an employee whose
 * components have never been entered: given a gross and no components, it
 * seeds a starting split. Any component that IS set is used verbatim, so a row
 * like Basic 9000 / HRA 5000 / Others 3000 sums to exactly 17000 rather than
 * being re-derived as 8500/4250/4250.
 */
export function splitMasterGross(
  masterGross: number,
  overrides: { basic?: number | null; hra?: number | null; others?: number | null } = {}
): { basic: number; hra: number; others: number } {
  const anyComponentSet =
    overrides.basic != null || overrides.hra != null || overrides.others != null

  if (anyComponentSet) {
    // Components are the source of truth; an unfilled one contributes nothing
    // rather than silently reintroducing a percentage of the gross.
    return {
      basic: overrides.basic ?? 0,
      hra: overrides.hra ?? 0,
      others: overrides.others ?? 0,
    }
  }

  return {
    basic: round2(masterGross * 0.5),
    hra: round2(masterGross * 0.25),
    others: round2(masterGross * 0.25),
  }
}

/** xlsx AA: =SUM(U:Z) - Basic + HRA + Others + Special 1 + Special 2. */
export function masterGrossTotal(p: {
  basic: number
  hra: number
  others: number
  special1: number
  special2: number
}): number {
  return round2(p.basic + p.hra + p.others + p.special1 + p.special2)
}

/** xlsx AC: =IF((AA-V>15000),15000,AA-V) - PF wage basis capped at the ceiling. */
export function masterPfBasic(masterGross: number, masterHra: number, r: StatutoryRates): number {
  const basis = masterGross - masterHra
  return round2(basis > r.pfWageCeiling ? r.pfWageCeiling : basis)
}

/** xlsx AD: =AC*12% */
export function masterCoPf(pfBasic: number, r: StatutoryRates): number {
  return round2(pfBasic * r.pfEmployerRate)
}

/**
 * xlsx AE: =IF((AA>21000),"NO ESI","ESI")
 *
 * Eligibility is decided on MASTER GROSS, matching the workbook's AA reference
 * and the statutory rule that the wage ceiling applies to gross wages.
 * Eligibility is a fixed property of the salary structure - a month reduced by
 * LOP never changes it in either direction.
 */
export function masterForEsi(eligibilityWage: number, r: StatutoryRates): 'ESI' | 'NO ESI' {
  return eligibilityWage > r.esiWageThreshold ? 'NO ESI' : 'ESI'
}

/**
 * xlsx AF: =IF((AA>21000),0,AA) - the master ESI wage base.
 * Eligibility comes from the basic; the base itself stays the master gross,
 * matching the workbook and standard practice of computing ESI on gross wages.
 */
export function masterEsiGross(
  masterGross: number,
  eligibilityWage: number,
  r: StatutoryRates
): number {
  return eligibilityWage > r.esiWageThreshold ? 0 : round2(masterGross)
}

/** xlsx AG: =IF((AA>21000),0,(AA*3.25%)) - employer share at master level. */
export function masterCoEsi(
  masterGross: number,
  eligibilityWage: number,
  r: StatutoryRates
): number {
  return eligibilityWage > r.esiWageThreshold ? 0 : round2(masterGross * r.esiEmployerRate)
}

/** xlsx AH: =AA+AD+AG - monthly fixed CTC. */
export function masterCtcPm(masterGross: number, coPf: number, coEsi: number): number {
  return round2(masterGross + coPf + coEsi)
}

/** xlsx AK: =AI+AJ - annual fixed CTC plus annual variable pay. */
export function masterCtcPaTotal(ctcPa: number, variablePayPa: number): number {
  return round2(ctcPa + variablePayPa)
}

// ─── Monthly earnings (xlsx AQ-AW) ───────────────────────────────────────────

/**
 * xlsx AQ/AR/AS: =((U/$AL)*$AO) - master component prorated over calendar days
 * by the number of payable days.
 *
 * Note the denominator is AL (Calendar Days), not AM (Days in Month); they are
 * equal in the sample sheet but are separate columns, so the distinction is
 * preserved here.
 */
export function prorate(masterComponent: number, calendarDays: number, daysForSalary: number): number {
  if (calendarDays <= 0) return 0
  return round2((masterComponent / calendarDays) * daysForSalary)
}

/** xlsx AV: =SUM(AQ:AU) */
export function monthlyGrossTotal(p: {
  basic: number
  hra: number
  others: number
  special1: number
  special2: number
}): number {
  return round2(p.basic + p.hra + p.others + p.special1 + p.special2)
}

/**
 * xlsx AW: =AV-AR - "Gross-HRA". This is the PF/admin/EDLI wage basis, i.e.
 * monthly gross excluding the HRA component.
 */
export function grossMinusHra(monthlyGross: number, monthlyHra: number): number {
  return round2(monthlyGross - monthlyHra)
}

// ─── Employee deductions (xlsx AX-BF) ────────────────────────────────────────

/**
 * xlsx AX: =IF(AW>15000,1800,ROUND((AW*12%),0))
 * Above the ceiling the workbook uses a flat 1800; below it, 12% rounded to
 * whole rupees (ROUND(...,0), not banker's rounding).
 */
export function employeePf(grossHra: number, r: StatutoryRates, pfApplicable = true): number {
  if (!pfApplicable) return 0
  if (grossHra > r.pfWageCeiling) return r.pfCappedAmount
  return Math.round(grossHra * r.pfEmployeeRate)
}

/**
 * ESI daily-average exemption threshold. An employee whose average daily wage
 * falls to this or below is exempt from their own 0.75% share for the month;
 * the employer still pays the full 3.25% so cover is maintained.
 */
export const ESI_DAILY_WAGE_EXEMPTION = 176

/**
 * Is the employee within the ESI scheme at all?
 *
 * Eligibility is decided by the FIXED (master) gross, not by what was earned in
 * a given month:
 *  - master above the threshold: a month reduced by LOP does NOT pull them in
 *  - master below the threshold: they stay covered even when LOP reduces pay
 *
 * This is what the workbook approximates with `AG>1` in AY: AG is derived from
 * the master gross, so it is really a master-level eligibility flag.
 */
export function isEsiCovered(masterEligibilityWage: number, r: StatutoryRates): boolean {
  return masterEligibilityWage <= r.esiWageThreshold
}

/**
 * Average daily wage for the month: earned gross over days actually paid.
 * Used only for the exemption test below.
 */
export function dailyAverageWage(monthlyGross: number, daysForSalary: number): number {
  if (daysForSalary <= 0) return 0
  return round2(monthlyGross / daysForSalary)
}

/**
 * xlsx AY: =IF((AG>1),(AV*0.75%),0)
 *
 * Employee share, 0.75% of the EARNED gross - so a month cut by LOP produces a
 * proportionately smaller deduction rather than the full-salary figure.
 *
 * Waived entirely when the average daily wage falls to the exemption threshold
 * (default 176) or below; the employer's share is unaffected by that waiver.
 */
export function employeeEsi(
  monthlyGross: number,
  covered: boolean,
  r: StatutoryRates,
  esiApplicable = true,
  daysForSalary = 0
): number {
  if (!esiApplicable || !covered) return 0
  if (daysForSalary > 0) {
    const daily = dailyAverageWage(monthlyGross, daysForSalary)
    if (daily <= ESI_DAILY_WAGE_EXEMPTION) return 0
  }
  return round2(monthlyGross * r.esiEmployeeRate)
}

/** xlsx BD: =SUM(AX:BC) - PF + ESI + TDS + PT + Deduction 1 + Deduction 2. */
export function totalDeduction(p: {
  pf: number
  esi: number
  tds: number
  pt: number
  deduction1: number
  deduction2: number
}): number {
  return round2(p.pf + p.esi + p.tds + p.pt + p.deduction1 + p.deduction2)
}

/**
 * xlsx BF: =AV-BD-BE - monthly gross less total deductions less TDA.
 * Approved adjustments are folded in on top (positive adds, negative deducts).
 */
export function netPay(monthlyGross: number, totalDeductionValue: number, tda: number, adjustments = 0): number {
  return round2(monthlyGross - totalDeductionValue - tda + adjustments)
}

// ─── Employer contributions (xlsx BG-BK) ─────────────────────────────────────

/** xlsx BG: =AX - employer PF mirrors the employee PF figure. */
export function employerPf(employeePfValue: number): number {
  return round2(employeePfValue)
}

/** xlsx BH: =IF(AW>15000,15000*0.5%,AW*0.5%) */
export function adminCharges(grossHra: number, r: StatutoryRates, pfApplicable = true): number {
  if (!pfApplicable) return 0
  const basis = grossHra > r.pfWageCeiling ? r.pfWageCeiling : grossHra
  return round2(basis * r.adminChargeRate)
}

/** xlsx BI: =IF(AW>15000,15000*0.5%,AW*0.5%) - same basis as admin charges. */
export function edliCharges(grossHra: number, r: StatutoryRates, pfApplicable = true): number {
  if (!pfApplicable) return 0
  const basis = grossHra > r.pfWageCeiling ? r.pfWageCeiling : grossHra
  return round2(basis * r.edliChargeRate)
}

/**
 * xlsx BJ: =IF(AV<21000,AV*3.25%,0)
 *
 * Employer share, 3.25% of the EARNED gross. Coverage is the same master-level
 * decision the employee side uses, so both halves of the contribution always
 * agree on who is in the scheme.
 *
 * The employer pays this in full even when the employee is exempted by the
 * daily-average rule - that waiver applies to the employee's share only.
 */
export function employerEsi(
  monthlyGross: number,
  covered: boolean,
  r: StatutoryRates,
  esiApplicable = true
): number {
  if (!esiApplicable || !covered) return 0
  return round2(monthlyGross * r.esiEmployerRate)
}

/**
 * xlsx BK. The workbook contains two variants of this column:
 *   8 rows: =AX+BA+BF+BG+BH+BI            (omits both ESI columns)
 *   1 row:  =AX+BA+BF+BG+BH+BI+AY+BJ      (includes employee + employer ESI)
 *
 * The ESI-inclusive variant is implemented because a total employer cost that
 * silently drops employer ESI understates the cost of every ESI-eligible
 * employee. Flagged for management confirmation.
 */
export function totalEmployerCost(p: {
  employeePf: number
  employeePt: number
  netPay: number
  employerPf: number
  adminCharges: number
  edliCharges: number
  employeeEsi: number
  employerEsi: number
}): number {
  return round2(
    p.employeePf +
      p.employeePt +
      p.netPay +
      p.employerPf +
      p.adminCharges +
      p.edliCharges +
      p.employeeEsi +
      p.employerEsi
  )
}
