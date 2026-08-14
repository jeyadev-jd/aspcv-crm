import prisma from '../../lib/prisma'
import { PayrollLifecycle } from '@prisma/client'
import * as F from './formulas'
import { calcTDS } from './tds'
import {
  cycleWindow,
  daysInMonth,
  calendarDaysInCycle,
  classifyLifecycle,
  payableWindowDays,
  summariseAttendance,
  type AttendanceSummary,
} from './period'

/**
 * The single authoritative payroll calculation. The frontend never recomputes
 * any of this - it requests a result and renders the breakdown.
 *
 * A calculation is reproducible for a given (employee, period): the same
 * master values, attendance and statutory config always yield the same output.
 */

export interface PayrollCalculation {
  userId: string
  month: number
  year: number
  lifecycle: PayrollLifecycle

  // Master salary (xlsx U-AK)
  masterBasic: number
  masterHra: number
  masterOthers: number
  masterSpecial1: number
  masterSpecial2: number
  masterGross: number
  masterPfBasic: number
  masterCoPf: number
  masterForEsi: string
  masterEsiGross: number
  masterCoEsi: number
  masterCtcPm: number
  masterCtcPa: number
  variablePayPa: number
  masterCtcPaTotal: number

  // Days (xlsx AL-AO)
  calendarDays: number
  daysInMonth: number
  lop: number
  daysForSalary: number
  daysPresent: number
  daysAbsent: number
  lateDays: number
  lateLopDays: number
  approvedLeaveDays: number
  holidayDays: number
  weeklyOffDays: number

  // Monthly earnings (xlsx AQ-AW)
  monthlyBasic: number
  monthlyHra: number
  monthlyOthers: number
  monthlySpecial1: number
  monthlySpecial2: number
  monthlyGross: number
  grossHra: number

  // Deductions (xlsx AX-BF)
  employeePf: number
  employeeEsi: number
  employeeTds: number
  employeePt: number
  employeeDeduction1: number
  employeeDeduction2: number
  totalDeduction: number
  tda: number
  adjustmentTotal: number
  netPay: number

  // Employer (xlsx BG-BK)
  employerPf: number
  adminCharges: number
  edliCharges: number
  employerEsi: number
  totalEmployerCost: number

  configVersion: string
}

export class PayrollValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PayrollValidationError'
  }
}

/** Loads the active statutory config, falling back to the workbook defaults. */
export async function loadRates(): Promise<F.StatutoryRates> {
  const cfg = await prisma.payrollStatutoryConfig.findFirst({
    where: { isActive: true },
    orderBy: { effectiveFrom: 'desc' },
  })
  if (!cfg) return F.DEFAULT_RATES
  return {
    version: cfg.version,
    pfWageCeiling: cfg.pfWageCeiling,
    pfEmployeeRate: cfg.pfEmployeeRate,
    pfEmployerRate: cfg.pfEmployerRate,
    pfCappedAmount: cfg.pfCappedAmount,
    esiWageThreshold: cfg.esiWageThreshold,
    esiEmployeeRate: cfg.esiEmployeeRate,
    esiEmployerRate: cfg.esiEmployerRate,
    adminChargeRate: cfg.adminChargeRate,
    edliChargeRate: cfg.edliChargeRate,
  }
}

/**
 * Monthly professional tax from the configured slab table. The workbook uses a
 * flat 208/month for Tamil Nadu; slabs are data so this can change without a
 * deploy. Returns 0 when nothing is configured rather than guessing a rate.
 */
export async function resolveProfessionalTax(monthlyGross: number, state = 'Tamil Nadu'): Promise<number> {
  const slabs = await prisma.professionalTaxSlab.findMany({
    where: { state, isActive: true },
    orderBy: { minAmount: 'asc' },
  })
  const match = slabs.find(
    (s) => monthlyGross >= s.minAmount && (s.maxAmount === null || monthlyGross <= s.maxAmount)
  )
  return match ? F.round2(match.amount) : 0
}

interface CalcOptions {
  /** Manual monthly inputs the workbook leaves as blank data-entry columns. */
  monthlySpecial1?: number
  monthlySpecial2?: number
  employeeDeduction1?: number
  employeeDeduction2?: number
  tda?: number
  /** Overrides the attendance-derived LOP (HR correction on a draft run). */
  lopOverride?: number
}

/**
 * Calculates one employee's payroll for one period. Pure with respect to the
 * database: it reads inputs but writes nothing, so it can be previewed safely.
 */
export async function calculatePayroll(
  userId: string,
  month: number,
  year: number,
  options: CalcOptions = {}
): Promise<PayrollCalculation> {
  if (month < 1 || month > 12) throw new PayrollValidationError('Month must be between 1 and 12')
  if (year < 2000 || year > 2100) throw new PayrollValidationError('Year is out of range')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new PayrollValidationError('Employee not found')

  // Master gross is the anchor value; without it nothing else can be derived.
  // Falls back to the legacy baseSalary+hra+allowances trio so employees who
  // predate the master-salary fields still calculate.
  const legacyGross = (user.baseSalary ?? 0) + (user.hra ?? 0) + (user.allowances ?? 0)
  const masterGrossInput = user.masterGross ?? (legacyGross > 0 ? legacyGross : null)
  if (!masterGrossInput || masterGrossInput <= 0) {
    throw new PayrollValidationError('Master salary is not configured for this employee')
  }
  if (masterGrossInput < 0) throw new PayrollValidationError('Master gross cannot be negative')

  if (user.dateOfBirth && user.joiningDate && user.dateOfBirth >= user.joiningDate) {
    throw new PayrollValidationError('Date of birth must precede the joining date')
  }
  if (user.joiningDate && user.lastWorkingDate && user.lastWorkingDate < user.joiningDate) {
    throw new PayrollValidationError('Last working date cannot precede the joining date')
  }

  const rates = await loadRates()
  const { cycleStart, cycleEnd } = cycleWindow(month, year)
  const calDays = calendarDaysInCycle(cycleStart, cycleEnd)
  const dim = daysInMonth(month, year)

  // ── Master salary (xlsx U-AK) ──
  const split = F.splitMasterGross(masterGrossInput, {
    basic: user.masterBasic,
    hra: user.masterHra,
    others: user.masterOthers,
  })
  const masterSpecial1 = user.masterSpecial1 ?? 0
  const masterSpecial2 = user.masterSpecial2 ?? 0
  const masterGross = F.masterGrossTotal({
    basic: split.basic,
    hra: split.hra,
    others: split.others,
    special1: masterSpecial1,
    special2: masterSpecial2,
  })

  const masterPfBasic = F.masterPfBasic(masterGross, split.hra, rates)
  const masterCoPf = user.pfApplicable ? F.masterCoPf(masterPfBasic, rates) : 0
  const masterForEsi = F.masterForEsi(masterGross, rates)
  const masterEsiGross = user.esiApplicable ? F.masterEsiGross(masterGross, rates) : 0
  const masterCoEsi = user.esiApplicable ? F.masterCoEsi(masterGross, rates) : 0
  const masterCtcPm = F.masterCtcPm(masterGross, masterCoPf, masterCoEsi)
  const masterCtcPa = F.round2(masterCtcPm * 12)
  const variablePayPa = user.variablePayPa ?? 0
  const masterCtcPaTotal = F.masterCtcPaTotal(masterCtcPa, variablePayPa)

  // ── Days (xlsx AL-AO) ──
  const lifecycle = classifyLifecycle(user.joiningDate, user.lastWorkingDate, cycleStart, cycleEnd)
  const payableDays = payableWindowDays(
    user.joiningDate,
    user.lastWorkingDate,
    cycleStart,
    cycleEnd,
    calDays
  )

  let attendance: AttendanceSummary
  if (options.lopOverride !== undefined) {
    if (options.lopOverride < 0) throw new PayrollValidationError('LOP cannot be negative')
    if (options.lopOverride > payableDays) {
      throw new PayrollValidationError('LOP cannot exceed the payable days in the period')
    }
    const base = await summariseAttendance(userId, cycleStart, cycleEnd, payableDays)
    attendance = { ...base, lop: options.lopOverride }
  } else {
    attendance = await summariseAttendance(userId, cycleStart, cycleEnd, payableDays)
  }

  const daysForSalary = Math.max(0, F.round2(payableDays - attendance.lop))

  // ── Monthly earnings (xlsx AQ-AW) ──
  const monthlyBasic = F.prorate(split.basic, calDays, daysForSalary)
  const monthlyHra = F.prorate(split.hra, calDays, daysForSalary)
  const monthlyOthers = F.prorate(split.others, calDays, daysForSalary)
  // Special payments are entered per period rather than prorated; the workbook
  // leaves AT/AU as manual columns.
  const monthlySpecial1 = options.monthlySpecial1 ?? 0
  const monthlySpecial2 = options.monthlySpecial2 ?? 0
  const monthlyGross = F.monthlyGrossTotal({
    basic: monthlyBasic,
    hra: monthlyHra,
    others: monthlyOthers,
    special1: monthlySpecial1,
    special2: monthlySpecial2,
  })
  const grossHra = F.grossMinusHra(monthlyGross, monthlyHra)

  // ── Deductions (xlsx AX-BF) ──
  const employeePf = F.employeePf(grossHra, rates, user.pfApplicable)
  const employeeEsi = F.employeeEsi(monthlyGross, masterCoEsi, rates, user.esiApplicable)
  // TDS uses the existing CRM implementation, annualised off the master CTC.
  const employeeTds = calcTDS(masterGross * 12)
  const employeePt = await resolveProfessionalTax(monthlyGross)
  const employeeDeduction1 = options.employeeDeduction1 ?? 0
  const employeeDeduction2 = options.employeeDeduction2 ?? 0
  const totalDeduction = F.totalDeduction({
    pf: employeePf,
    esi: employeeEsi,
    tds: employeeTds,
    pt: employeePt,
    deduction1: employeeDeduction1,
    deduction2: employeeDeduction2,
  })
  const tda = options.tda ?? 0

  // Approved adjustments for this employee and period.
  const adjustments = await prisma.payrollAdjustment.findMany({
    where: { userId, month, year, approvedAt: { not: null } },
  })
  const adjustmentTotal = F.round2(adjustments.reduce((s, a) => s + a.amount, 0))

  const netPay = F.netPay(monthlyGross, totalDeduction, tda, adjustmentTotal)

  // ── Employer contributions (xlsx BG-BK) ──
  const employerPf = user.pfApplicable ? F.employerPf(employeePf) : 0
  const adminCharges = F.adminCharges(grossHra, rates, user.pfApplicable)
  const edliCharges = F.edliCharges(grossHra, rates, user.pfApplicable)
  const employerEsi = F.employerEsi(monthlyGross, rates, user.esiApplicable)
  const totalEmployerCost = F.totalEmployerCost({
    employeePf,
    employeePt,
    netPay,
    employerPf,
    adminCharges,
    edliCharges,
    employeeEsi,
    employerEsi,
  })

  return {
    userId,
    month,
    year,
    lifecycle,
    masterBasic: split.basic,
    masterHra: split.hra,
    masterOthers: split.others,
    masterSpecial1,
    masterSpecial2,
    masterGross,
    masterPfBasic,
    masterCoPf,
    masterForEsi,
    masterEsiGross,
    masterCoEsi,
    masterCtcPm,
    masterCtcPa,
    variablePayPa,
    masterCtcPaTotal,
    calendarDays: calDays,
    daysInMonth: dim,
    lop: attendance.lop,
    daysForSalary,
    daysPresent: attendance.daysPresent,
    daysAbsent: attendance.daysAbsent,
    lateDays: attendance.lateDays,
    lateLopDays: attendance.lateLopDays,
    approvedLeaveDays: attendance.approvedLeaveDays,
    holidayDays: attendance.holidayDays,
    weeklyOffDays: attendance.weeklyOffDays,
    monthlyBasic,
    monthlyHra,
    monthlyOthers,
    monthlySpecial1,
    monthlySpecial2,
    monthlyGross,
    grossHra,
    employeePf,
    employeeEsi,
    employeeTds,
    employeePt,
    employeeDeduction1,
    employeeDeduction2,
    totalDeduction,
    tda,
    adjustmentTotal,
    netPay,
    employerPf,
    adminCharges,
    edliCharges,
    employerEsi,
    totalEmployerCost,
    configVersion: rates.version,
  }
}

/** Maps a calculation onto the PayrollRecord column set. */
export function toRecordData(calc: PayrollCalculation) {
  return {
    lifecycle: calc.lifecycle,
    masterBasic: calc.masterBasic,
    masterHra: calc.masterHra,
    masterOthers: calc.masterOthers,
    masterSpecial1: calc.masterSpecial1,
    masterSpecial2: calc.masterSpecial2,
    masterGross: calc.masterGross,
    masterPfBasic: calc.masterPfBasic,
    masterCoPf: calc.masterCoPf,
    masterForEsi: calc.masterForEsi,
    masterEsiGross: calc.masterEsiGross,
    masterCoEsi: calc.masterCoEsi,
    masterCtcPm: calc.masterCtcPm,
    masterCtcPa: calc.masterCtcPa,
    variablePayPa: calc.variablePayPa,
    masterCtcPaTotal: calc.masterCtcPaTotal,
    lop: calc.lop,
    daysForSalary: calc.daysForSalary,
    daysPresent: calc.daysPresent,
    daysAbsent: calc.daysAbsent,
    lateDays: calc.lateDays,
    lateLopDays: calc.lateLopDays,
    approvedLeaveDays: calc.approvedLeaveDays,
    holidayDays: calc.holidayDays,
    weeklyOffDays: calc.weeklyOffDays,
    monthlyBasic: calc.monthlyBasic,
    monthlyHra: calc.monthlyHra,
    monthlyOthers: calc.monthlyOthers,
    monthlySpecial1: calc.monthlySpecial1,
    monthlySpecial2: calc.monthlySpecial2,
    monthlyGross: calc.monthlyGross,
    grossHra: calc.grossHra,
    employeePf: calc.employeePf,
    employeeEsi: calc.employeeEsi,
    employeeTds: calc.employeeTds,
    employeePt: calc.employeePt,
    employeeDeduction1: calc.employeeDeduction1,
    employeeDeduction2: calc.employeeDeduction2,
    totalDeduction: calc.totalDeduction,
    tda: calc.tda,
    netPay: calc.netPay,
    employerPf: calc.employerPf,
    adminCharges: calc.adminCharges,
    edliCharges: calc.edliCharges,
    employerEsi: calc.employerEsi,
    totalEmployerCost: calc.totalEmployerCost,
    adjustmentTotal: calc.adjustmentTotal,
    configVersion: calc.configVersion,
    calculatedAt: new Date(),
  }
}
