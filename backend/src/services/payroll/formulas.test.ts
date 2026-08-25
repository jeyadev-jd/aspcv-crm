import { describe, it, expect } from 'vitest'
import * as F from './formulas'
import { calcTDS } from './tds'
import { cycleWindow, classifyLifecycle, payableWindowDays, calendarDaysInCycle } from './period'

const R = F.DEFAULT_RATES

/**
 * Reference case: Salary Model.xlsx row 2 (Logesh N), Master Gross 10000,
 * June 2026, 31 calendar days, no LOP.
 *
 *   U (Basic)      = 10000 * 50%  = 5000
 *   V (HRA)        = 10000 * 25%  = 2500
 *   W (Others)     = 10000 * 25%  = 2500
 *   AA (Gross)     = 10000
 *   AC (PF Basic)  = min(10000-2500, 15000) = 7500
 *   AD (Co PF)     = 7500 * 12%   = 900
 *   AF (ESI Gross) = 10000        (<= 21000)
 *   AG (Co ESI)    = 10000 * 3.25% = 325
 *   AH (CTC PM)    = 10000+900+325 = 11225
 *   AW (Gross-HRA) = 10000-2500   = 7500
 *   AX (Emp PF)    = ROUND(7500*12%,0) = 900
 *   AY (Emp ESI)   = 10000 * 0.75% = 75
 *   BH/BI          = 7500 * 0.5%  = 37.5 each
 *   BJ (Er ESI)    = 10000 * 3.25% = 325
 */
const SAMPLE_GROSS = 10000

describe('master salary (xlsx U-AK)', () => {
  it('splits master gross 50/25/25', () => {
    const s = F.splitMasterGross(SAMPLE_GROSS)
    expect(s.basic).toBe(5000)
    expect(s.hra).toBe(2500)
    expect(s.others).toBe(2500)
  })

  it('honours explicit component overrides', () => {
    const s = F.splitMasterGross(SAMPLE_GROSS, { basic: 6000, hra: 2000, others: 2000 })
    expect(s).toEqual({ basic: 6000, hra: 2000, others: 2000 })
  })

  /**
   * U/V/W are blank data-entry cells in the workbook and AA is =SUM(U:Z), so
   * typed components must drive the gross rather than being re-derived from it.
   * Reference: Basic 9000 / HRA 5000 / Others 3000.
   */
  it('drives gross from typed components rather than re-splitting it', () => {
    const s = F.splitMasterGross(17000, { basic: 9000, hra: 5000, others: 3000 })
    expect(s).toEqual({ basic: 9000, hra: 5000, others: 3000 })

    const gross = F.masterGrossTotal({ ...s, special1: 0, special2: 0 })
    expect(gross).toBe(17000)

    // PF basis = Gross − HRA = 12000, under the 15000 ceiling.
    expect(F.masterPfBasic(gross, s.hra, R)).toBe(12000)
    expect(F.masterCoPf(12000, R)).toBe(1440)
  })

  it('does not reintroduce a percentage for a component left blank', () => {
    // Only Basic supplied - HRA/Others contribute nothing rather than 25% each.
    const s = F.splitMasterGross(17000, { basic: 9000 })
    expect(s).toEqual({ basic: 9000, hra: 0, others: 0 })
  })

  it('sums master gross from components (AA)', () => {
    expect(
      F.masterGrossTotal({ basic: 5000, hra: 2500, others: 2500, special1: 0, special2: 0 })
    ).toBe(10000)
  })

  it('includes special payments in master gross', () => {
    expect(
      F.masterGrossTotal({ basic: 5000, hra: 2500, others: 2500, special1: 1000, special2: 500 })
    ).toBe(11500)
  })

  it('caps PF basis at the ceiling (AC)', () => {
    expect(F.masterPfBasic(10000, 2500, R)).toBe(7500)
    // 40000 gross, 10000 HRA -> basis 30000, capped to 15000
    expect(F.masterPfBasic(40000, 10000, R)).toBe(15000)
  })

  it('computes employer PF at 12% of the capped basis (AD)', () => {
    expect(F.masterCoPf(7500, R)).toBe(900)
    expect(F.masterCoPf(15000, R)).toBe(1800)
  })

  it('flags ESI eligibility at the 21000 threshold (AE)', () => {
    expect(F.masterForEsi(10000, R)).toBe('ESI')
    expect(F.masterForEsi(21000, R)).toBe('ESI') // boundary: not > 21000
    expect(F.masterForEsi(21001, R)).toBe('NO ESI')
  })

  it('zeroes ESI gross and employer ESI above the threshold (AF/AG)', () => {
    // Signature is (masterGross, eligibilityWage, rates) - eligibility and the
    // contribution base are both the master gross.
    expect(F.masterEsiGross(10000, 10000, R)).toBe(10000)
    expect(F.masterCoEsi(10000, 10000, R)).toBe(325)
    expect(F.masterEsiGross(25000, 25000, R)).toBe(0)
    expect(F.masterCoEsi(25000, 25000, R)).toBe(0)
  })

  /**
   * Eligibility is tested on MASTER GROSS. A gross of 25000 is outside the
   * scheme even though its 50% basic (12500) sits below the threshold - the
   * basic must never decide coverage.
   */
  it('decides eligibility on master gross rather than master basic', () => {
    const gross = 25000
    const basic = F.splitMasterGross(gross).basic // 12500, below the threshold
    expect(basic).toBeLessThan(R.esiWageThreshold)

    expect(F.masterForEsi(gross, R)).toBe('NO ESI')
    expect(F.isEsiCovered(gross, R)).toBe(false)
    expect(F.masterEsiGross(gross, gross, R)).toBe(0)
    expect(F.masterCoEsi(gross, gross, R)).toBe(0)
  })

  it('covers an employee whose master gross is at or below the threshold', () => {
    expect(F.masterForEsi(21000, R)).toBe('ESI')
    expect(F.isEsiCovered(21000, R)).toBe(true)
    expect(F.masterEsiGross(21000, 21000, R)).toBe(21000)
  })

  it('computes monthly and annual CTC (AH/AI/AK)', () => {
    const ctcPm = F.masterCtcPm(10000, 900, 325)
    expect(ctcPm).toBe(11225)
    expect(F.round2(ctcPm * 12)).toBe(134700)
    expect(F.masterCtcPaTotal(134700, 50000)).toBe(184700)
  })
})

describe('monthly earnings (xlsx AQ-AW)', () => {
  it('pays the full component for a full month', () => {
    expect(F.prorate(5000, 31, 31)).toBe(5000)
  })

  it('prorates by payable days', () => {
    // 5000 / 31 * 15 = 2419.35
    expect(F.prorate(5000, 31, 15)).toBe(2419.35)
  })

  it('pays nothing for zero payable days', () => {
    expect(F.prorate(5000, 31, 0)).toBe(0)
  })

  it('guards against a zero-day denominator', () => {
    expect(F.prorate(5000, 0, 10)).toBe(0)
  })

  it('computes Gross-HRA as the PF wage basis (AW)', () => {
    expect(F.grossMinusHra(10000, 2500)).toBe(7500)
  })
})

describe('employee deductions (xlsx AX-BF)', () => {
  it('computes PF at 12% below the ceiling, rounded to rupees (AX)', () => {
    expect(F.employeePf(7500, R)).toBe(900)
  })

  it('caps PF at the flat 1800 above the ceiling (AX)', () => {
    expect(F.employeePf(20000, R)).toBe(1800)
    // Boundary: exactly at the ceiling still uses the percentage.
    expect(F.employeePf(15000, R)).toBe(1800) // 15000*12% = 1800 either way
    expect(F.employeePf(15001, R)).toBe(1800)
  })

  it('returns zero PF when the employee is not PF-applicable', () => {
    expect(F.employeePf(7500, R, false)).toBe(0)
  })

  it('computes employee ESI at 0.75% of the earned gross (AY)', () => {
    expect(F.employeeEsi(10000, true, R)).toBe(75)
  })

  /**
   * Scenario A: fixed gross above the limit, LOP drops earned gross below it.
   * The employee stays OUT - a temporary drop does not pull them in.
   */
  it('does not pull an exempt employee in when LOP drops their earned gross', () => {
    // Master gross 25000 -> not covered. Earned only 18000 this month.
    const covered = F.isEsiCovered(25000, R)
    expect(covered).toBe(false)
    expect(F.employeeEsi(18000, covered, R)).toBe(0)
    expect(F.employerEsi(18000, covered, R)).toBe(0)
  })

  /**
   * Scenario B: covered employee with LOP contributes on the REDUCED earned
   * gross, not the full salary.
   */
  it('charges a covered employee proportionately on the reduced earned gross', () => {
    // Master gross 20000 -> covered. 5 days LOP left 16667 earned.
    const covered = F.isEsiCovered(20000, R)
    expect(covered).toBe(true)
    expect(F.employeeEsi(16667, covered, R)).toBe(125)
    expect(F.employerEsi(16667, covered, R)).toBe(541.68)
  })

  it('honours an explicit ESI exemption on the employee', () => {
    expect(F.employeeEsi(10000, true, R, false)).toBe(0)
  })

  it('keeps employee and employer ESI agreeing on coverage', () => {
    // Both sides read the same master-level decision, so one can never
    // contribute while the other does not.
    for (const basic of [15000, 20999, 21000, 21500]) {
      const covered = F.isEsiCovered(basic, R)
      const emp = F.employeeEsi(18000, covered, R)
      const er = F.employerEsi(18000, covered, R)
      expect(emp > 0).toBe(er > 0)
    }
  })

  /**
   * The 176 daily-average rule: when earnings per paid day fall to the
   * threshold or below, the employee's 0.75% is waived but the employer still
   * pays its full 3.25% so cover is maintained.
   */
  describe('daily-average wage exemption', () => {
    it('computes the average over days actually paid', () => {
      expect(F.dailyAverageWage(5280, 30)).toBe(176)
    })

    it('waives the employee share at or below the threshold', () => {
      // 5280 over 30 paid days = exactly 176.
      expect(F.employeeEsi(5280, true, R, true, 30)).toBe(0)
      // Employer still pays.
      expect(F.employerEsi(5280, true, R)).toBe(171.6)
    })

    it('still charges the employee just above the threshold', () => {
      // 5310 over 30 days = 177, above the exemption. 5310 * 0.75% = 39.825.
      expect(F.employeeEsi(5310, true, R, true, 30)).toBe(39.82)
    })

    it('ignores the exemption when no day count is supplied', () => {
      expect(F.employeeEsi(5280, true, R, true, 0)).toBe(39.6)
    })
  })

  it('sums total deduction (BD)', () => {
    expect(
      F.totalDeduction({ pf: 900, esi: 75, tds: 0, pt: 208, deduction1: 0, deduction2: 0 })
    ).toBe(1183)
  })

  it('computes net pay as gross less deductions less TDA (BF)', () => {
    expect(F.netPay(10000, 1183, 0)).toBe(8817)
    expect(F.netPay(10000, 1183, 500)).toBe(8317)
  })

  it('folds approved adjustments into net pay', () => {
    expect(F.netPay(10000, 1183, 0, 1000)).toBe(9817)
    expect(F.netPay(10000, 1183, 0, -500)).toBe(8317)
  })

  it('handles a zero-deduction employee', () => {
    expect(F.totalDeduction({ pf: 0, esi: 0, tds: 0, pt: 0, deduction1: 0, deduction2: 0 })).toBe(0)
    expect(F.netPay(10000, 0, 0)).toBe(10000)
  })
})

describe('employer contributions (xlsx BG-BK)', () => {
  it('mirrors employee PF (BG)', () => {
    expect(F.employerPf(900)).toBe(900)
  })

  it('computes admin and EDLI at 0.5% of the capped basis (BH/BI)', () => {
    expect(F.adminCharges(7500, R)).toBe(37.5)
    expect(F.edliCharges(7500, R)).toBe(37.5)
    // Above the ceiling both use 15000 as the basis.
    expect(F.adminCharges(20000, R)).toBe(75)
    expect(F.edliCharges(20000, R)).toBe(75)
  })

  it('computes employer ESI at 3.25% of the earned gross (BJ)', () => {
    expect(F.employerEsi(10000, true, R)).toBe(325)
  })

  it('pays nothing for an employee outside the scheme', () => {
    expect(F.employerEsi(20999, false, R)).toBe(0)
  })

  it('computes total employer cost including ESI (BK)', () => {
    const cost = F.totalEmployerCost({
      employeePf: 900,
      employeePt: 208,
      netPay: 8817,
      employerPf: 900,
      adminCharges: 37.5,
      edliCharges: 37.5,
      employeeEsi: 75,
      employerEsi: 325,
    })
    expect(cost).toBe(11300)
  })
})

describe('end-to-end reference row (xlsx row 2)', () => {
  it('reproduces the workbook figures for a full month with no LOP', () => {
    const split = F.splitMasterGross(SAMPLE_GROSS)
    const masterGross = F.masterGrossTotal({ ...split, special1: 0, special2: 0 })
    const pfBasic = F.masterPfBasic(masterGross, split.hra, R)
    const coPf = F.masterCoPf(pfBasic, R)
    const coEsi = F.masterCoEsi(masterGross, masterGross, R)

    expect(masterGross).toBe(10000)
    expect(pfBasic).toBe(7500)
    expect(coPf).toBe(900)
    expect(coEsi).toBe(325)
    expect(F.masterCtcPm(masterGross, coPf, coEsi)).toBe(11225)

    const calendarDays = 31
    const daysForSalary = 31
    const monthlyBasic = F.prorate(split.basic, calendarDays, daysForSalary)
    const monthlyHra = F.prorate(split.hra, calendarDays, daysForSalary)
    const monthlyOthers = F.prorate(split.others, calendarDays, daysForSalary)
    const monthlyGross = F.monthlyGrossTotal({
      basic: monthlyBasic,
      hra: monthlyHra,
      others: monthlyOthers,
      special1: 0,
      special2: 0,
    })
    const grossHra = F.grossMinusHra(monthlyGross, monthlyHra)

    expect(monthlyGross).toBe(10000)
    expect(grossHra).toBe(7500)
    expect(F.employeePf(grossHra, R)).toBe(900)
    expect(F.employeeEsi(monthlyGross, coEsi > 0, R)).toBe(75)
    expect(F.adminCharges(grossHra, R)).toBe(37.5)
    expect(F.employerEsi(monthlyGross, coEsi > 0, R)).toBe(325)
  })

  it('halves the earnings for a half-month joiner', () => {
    const split = F.splitMasterGross(SAMPLE_GROSS)
    const monthlyGross = F.monthlyGrossTotal({
      basic: F.prorate(split.basic, 30, 15),
      hra: F.prorate(split.hra, 30, 15),
      others: F.prorate(split.others, 30, 15),
      special1: 0,
      special2: 0,
    })
    expect(monthlyGross).toBe(5000)
  })

  it('applies LOP before proration', () => {
    const split = F.splitMasterGross(SAMPLE_GROSS)
    const daysForSalary = 31 - 3 // 3 days LOP
    const monthlyGross = F.monthlyGrossTotal({
      basic: F.prorate(split.basic, 31, daysForSalary),
      hra: F.prorate(split.hra, 31, daysForSalary),
      others: F.prorate(split.others, 31, daysForSalary),
      special1: 0,
      special2: 0,
    })
    // 10000 / 31 * 28 = 9032.26 (component-wise rounding)
    expect(monthlyGross).toBeCloseTo(9032.26, 1)
  })

  it('adds special payments on top of prorated earnings', () => {
    const split = F.splitMasterGross(SAMPLE_GROSS)
    const monthlyGross = F.monthlyGrossTotal({
      basic: F.prorate(split.basic, 31, 31),
      hra: F.prorate(split.hra, 31, 31),
      others: F.prorate(split.others, 31, 31),
      special1: 5000,
      special2: 2500,
    })
    expect(monthlyGross).toBe(17500)
  })
})

describe('ESI eligibility cases', () => {
  it('treats an employee below the threshold as ESI-eligible throughout', () => {
    const g = 18000
    expect(F.masterForEsi(g, R)).toBe('ESI')
    expect(F.masterCoEsi(g, g, R)).toBe(585)
    expect(F.employeeEsi(g, true, R)).toBe(135)
    expect(F.employerEsi(g, true, R)).toBe(585)
  })

  it('excludes an employee above the threshold from every ESI figure', () => {
    const g = 30000
    expect(F.masterForEsi(g, R)).toBe('NO ESI')
    expect(F.masterEsiGross(g, g, R)).toBe(0)
    expect(F.masterCoEsi(g, g, R)).toBe(0)
    expect(F.employeeEsi(g, false, R)).toBe(0)
    expect(F.employerEsi(g, false, R)).toBe(0)
  })

  it('keeps a high earner out even when LOP drops their earned gross', () => {
    // Master gross 30000 puts them outside the scheme; a heavy-LOP month that
    // leaves only 16000 earned does NOT pull them in.
    const covered = F.isEsiCovered(30000, R)
    expect(covered).toBe(false)
    expect(F.employeeEsi(16000, covered, R)).toBe(0)
    expect(F.employerEsi(16000, covered, R)).toBe(0)
  })
})

describe('PF ceiling cases', () => {
  it('applies the ceiling to a high earner', () => {
    const gross = 60000
    const split = F.splitMasterGross(gross)
    const grossHra = F.grossMinusHra(gross, split.hra)
    expect(grossHra).toBe(45000)
    expect(F.employeePf(grossHra, R)).toBe(1800)
    expect(F.employerPf(F.employeePf(grossHra, R))).toBe(1800)
    expect(F.adminCharges(grossHra, R)).toBe(75)
  })
})

describe('payroll period (26th to 25th cycle)', () => {
  it('opens on the 26th of the previous month', () => {
    const { cycleStart, cycleEnd } = cycleWindow(6, 2026)
    expect(cycleStart.toISOString().slice(0, 10)).toBe('2026-05-26')
    expect(cycleEnd.toISOString().slice(0, 10)).toBe('2026-06-25')
  })

  it('counts calendar days across the window', () => {
    const { cycleStart, cycleEnd } = cycleWindow(6, 2026)
    expect(calendarDaysInCycle(cycleStart, cycleEnd)).toBe(31)
  })

  it('classifies a joiner inside the window', () => {
    const { cycleStart, cycleEnd } = cycleWindow(6, 2026)
    expect(classifyLifecycle(new Date('2026-06-01'), null, cycleStart, cycleEnd)).toBe('Joiner')
  })

  it('classifies a leaver inside the window', () => {
    const { cycleStart, cycleEnd } = cycleWindow(6, 2026)
    expect(classifyLifecycle(new Date('2020-01-01'), new Date('2026-06-10'), cycleStart, cycleEnd)).toBe('Leaver')
  })

  it('classifies a full-period employee as a stayer', () => {
    const { cycleStart, cycleEnd } = cycleWindow(6, 2026)
    expect(classifyLifecycle(new Date('2020-01-01'), null, cycleStart, cycleEnd)).toBe('Stayer')
  })

  it('pays a joiner only from the joining date', () => {
    const { cycleStart, cycleEnd } = cycleWindow(6, 2026)
    // Joined 11 June -> 11..25 June inclusive = 15 days
    expect(payableWindowDays(new Date('2026-06-11'), null, cycleStart, cycleEnd, 31)).toBe(15)
  })

  it('pays a leaver only up to the last working day', () => {
    const { cycleStart, cycleEnd } = cycleWindow(6, 2026)
    // 26 May .. 5 June inclusive = 11 days
    expect(payableWindowDays(new Date('2020-01-01'), new Date('2026-06-05'), cycleStart, cycleEnd, 31)).toBe(11)
  })

  it('pays nothing when the employment window misses the period', () => {
    const { cycleStart, cycleEnd } = cycleWindow(6, 2026)
    expect(payableWindowDays(new Date('2026-07-01'), null, cycleStart, cycleEnd, 31)).toBe(0)
  })
})

/**
 * Hours-based LOP (confirmed company rule): pay follows hours worked against
 * hours owed. With an 8-hour standard, an 8-hour shortfall costs one day and a
 * 16-hour shortfall costs two. Only whole standard-days are deducted.
 *
 * Mirrors the arithmetic in summariseAttendance so the rule is pinned without
 * needing a database.
 */
function hoursLop(requiredHours: number, workedHours: number, creditedLeaveHours = 0, standard = 8) {
  const shortfall = Math.max(0, requiredHours - workedHours - creditedLeaveHours)
  return { shortfall, lopDays: standard > 0 ? Math.floor(shortfall / standard) : 0 }
}

describe('hours-based LOP', () => {
  it('deducts nothing when the full month is worked', () => {
    // 24 working days x 8h = 192h owed, 192h worked.
    expect(hoursLop(192, 192)).toEqual({ shortfall: 0, lopDays: 0 })
  })

  it('cuts one day for an 8-hour shortfall', () => {
    expect(hoursLop(192, 184)).toEqual({ shortfall: 8, lopDays: 1 })
  })

  it('cuts two days for a 16-hour shortfall', () => {
    expect(hoursLop(192, 176)).toEqual({ shortfall: 16, lopDays: 2 })
  })

  it('ignores a partial-day shortfall', () => {
    // 7h short of the standard day - not yet a whole day of pay.
    expect(hoursLop(192, 185)).toEqual({ shortfall: 7, lopDays: 0 })
  })

  it('rounds a part-day shortfall down, never up', () => {
    // 15h short is one whole day plus 7h, so one day is cut.
    expect(hoursLop(192, 177)).toEqual({ shortfall: 15, lopDays: 1 })
  })

  it('never produces negative LOP when extra hours are worked', () => {
    expect(hoursLop(192, 210)).toEqual({ shortfall: 0, lopDays: 0 })
  })

  it('credits approved leave so it is not treated as a shortfall', () => {
    // Worked 176h, two approved leave days credited at 8h each = 192h total.
    expect(hoursLop(192, 176, 16)).toEqual({ shortfall: 0, lopDays: 0 })
  })

  it('still cuts when leave does not cover the whole gap', () => {
    // Owed 192, worked 168, one leave day credited (8h) - 16h still short.
    expect(hoursLop(192, 168, 8)).toEqual({ shortfall: 16, lopDays: 2 })
  })

  it('honours a non-8-hour standard day', () => {
    // 9-hour standard: 18h short is exactly two days.
    expect(hoursLop(180, 162, 0, 9)).toEqual({ shortfall: 18, lopDays: 2 })
  })

  it('deducts the whole month when nothing was worked', () => {
    expect(hoursLop(192, 0)).toEqual({ shortfall: 192, lopDays: 24 })
  })
})

describe('TDS (existing CRM implementation)', () => {
  it('charges nothing below the rebate limit', () => {
    expect(calcTDS(600000)).toBe(0)
  })

  it('charges tax above the rebate limit', () => {
    expect(calcTDS(1200000)).toBeGreaterThan(0)
  })

  it('never returns a negative liability', () => {
    expect(calcTDS(0)).toBe(0)
  })
})

describe('rounding', () => {
  it('rounds currency to two decimals', () => {
    expect(F.round2(37.499999)).toBe(37.5)
    expect(F.round2(0.1 + 0.2)).toBe(0.3)
  })

  it('rounds PF to whole rupees per the workbook ROUND(...,0)', () => {
    // 7499 * 12% = 899.88 -> 900
    expect(F.employeePf(7499, R)).toBe(900)
  })
})
