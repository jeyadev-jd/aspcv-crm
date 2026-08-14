import prisma from '../../lib/prisma'
import { PayrollLifecycle } from '@prisma/client'

/**
 * Payroll and leave cut-off is the 26th of the previous month to the 25th of
 * the payroll month (confirmed company rule).
 */
export function cycleWindow(month: number, year: number): { cycleStart: Date; cycleEnd: Date } {
  // month is 1-based; the window opens on the 26th of the preceding month.
  const cycleStart = new Date(Date.UTC(year, month - 2, 26, 0, 0, 0))
  const cycleEnd = new Date(Date.UTC(year, month - 1, 25, 23, 59, 59))
  return { cycleStart, cycleEnd }
}

/** Days in the payroll month itself (xlsx AM). */
export function daysInMonth(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Calendar days spanned by the cut-off window (xlsx AL). In the sample sheet
 * this equals days-in-month, but the two are separate columns so both are
 * computed independently.
 */
export function calendarDaysInCycle(cycleStart: Date, cycleEnd: Date): number {
  // cycleEnd carries a 23:59:59 time component, so both ends are floored to
  // midnight before differencing - otherwise the partial day rounds up and
  // every window reports one extra day.
  return dayDiffInclusive(cycleStart, cycleEnd)
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days between two instants, inclusive of both end dates. */
function dayDiffInclusive(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  return Math.round((b - a) / DAY_MS) + 1
}

/**
 * Classifies an employee against a payroll window (xlsx P/Q/R). Derived from
 * lifecycle dates rather than typed by hand.
 */
export function classifyLifecycle(
  joiningDate: Date | null | undefined,
  lastWorkingDate: Date | null | undefined,
  cycleStart: Date,
  cycleEnd: Date
): PayrollLifecycle {
  const joinedInWindow = !!joiningDate && joiningDate >= cycleStart && joiningDate <= cycleEnd
  const leftInWindow = !!lastWorkingDate && lastWorkingDate >= cycleStart && lastWorkingDate <= cycleEnd
  // A leaver classification takes precedence: an employee who joined and left
  // inside one window is being settled, and the payroll run must treat them as
  // an exit rather than a new joiner.
  if (leftInWindow) return PayrollLifecycle.Leaver
  if (joinedInWindow) return PayrollLifecycle.Joiner
  return PayrollLifecycle.Stayer
}

/**
 * Payable days for a partial-period employee. A joiner is only payable from
 * DOJ, a leaver only up to DOL; a full-period employee gets the whole window.
 */
export function payableWindowDays(
  joiningDate: Date | null | undefined,
  lastWorkingDate: Date | null | undefined,
  cycleStart: Date,
  cycleEnd: Date,
  calendarDays: number
): number {
  const from = joiningDate && joiningDate > cycleStart ? joiningDate : cycleStart
  const to = lastWorkingDate && lastWorkingDate < cycleEnd ? lastWorkingDate : cycleEnd
  if (to < from) return 0
  return Math.min(dayDiffInclusive(from, to), calendarDays)
}

export interface AttendanceSummary {
  daysPresent: number
  daysAbsent: number
  lateDays: number
  lateLopDays: number
  approvedLeaveDays: number
  holidayDays: number
  weeklyOffDays: number
  /** Total LOP: unapproved absence + the late-attendance penalty (xlsx AN). */
  lop: number
}

/**
 * Builds the attendance side of the calculation from approved data only.
 *
 * Confirmed company rules applied here:
 *  - weekly offs and holidays are payable, so they never create LOP
 *  - approved leave and approved half-days are payable
 *  - the late ladder (2 excused / 3 -> 1 day / 6 -> 2 days / 8 -> 2.5 days)
 *    comes from the LateLopRule table, matching highest threshold first
 *  - overtime and night shifts are not calculated
 */
export async function summariseAttendance(
  userId: string,
  cycleStart: Date,
  cycleEnd: Date,
  payableDays: number
): Promise<AttendanceSummary> {
  const [records, leaves, holidays, settings, lopRules] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { userId, date: { gte: cycleStart, lte: cycleEnd } },
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId,
        status: 'Approved',
        fromDate: { lte: cycleEnd },
        toDate: { gte: cycleStart },
      },
    }),
    prisma.holidayCalendar.findMany({
      where: { isActive: true, date: { gte: cycleStart, lte: cycleEnd } },
    }),
    prisma.attendanceSettings.findFirst({ where: { isActive: true } }),
    prisma.lateLopRule.findMany({ where: { isActive: true }, orderBy: { lateCount: 'desc' } }),
  ])

  const daysPresent = records.filter((r) => ['present', 'late', 'half_day'].includes(r.status)).length
  const lateDays = records.filter((r) => r.minutesLate > 0).length

  // Approved leave days that fall inside this window.
  const approvedLeaveDays = leaves.reduce((sum, l) => {
    const from = l.fromDate > cycleStart ? l.fromDate : cycleStart
    const to = l.toDate < cycleEnd ? l.toDate : cycleEnd
    if (to < from) return sum
    // Capped at the request's own totalDays so a half-day request contributes
    // 0.5 rather than a whole calendar day.
    return sum + Math.max(0, Math.min(dayDiffInclusive(from, to), l.totalDays))
  }, 0)

  const holidayDays = holidays.length

  // Weekly offs across the window, from the configured weekly-off day names.
  const weeklyOffNames: string[] = Array.isArray(settings?.weeklyOff)
    ? (settings?.weeklyOff as unknown as string[])
    : ['Sunday']
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  let weeklyOffDays = 0
  const totalDays = dayDiffInclusive(cycleStart, cycleEnd)
  const dayZero = Date.UTC(cycleStart.getUTCFullYear(), cycleStart.getUTCMonth(), cycleStart.getUTCDate())
  for (let i = 0; i < totalDays; i++) {
    const name = DAY_NAMES[new Date(dayZero + i * DAY_MS).getUTCDay()] as string
    if (weeklyOffNames.includes(name)) weeklyOffDays++
  }

  // Late-attendance penalty: highest matching threshold wins.
  let lateLopDays = 0
  for (const rule of lopRules) {
    if (lateDays >= rule.lateCount) {
      lateLopDays = rule.lopDays
      break
    }
  }

  // Unapproved absence = payable days not covered by attendance, approved
  // leave, holidays or weekly offs. Clamped at zero so an over-marked month
  // can never produce negative LOP.
  const accountedDays = daysPresent + approvedLeaveDays + holidayDays + weeklyOffDays
  const daysAbsent = Math.max(0, Math.round(payableDays - accountedDays))

  const lop = Math.min(payableDays, daysAbsent + lateLopDays)

  return {
    daysPresent,
    daysAbsent,
    lateDays,
    lateLopDays,
    approvedLeaveDays,
    holidayDays,
    weeklyOffDays,
    lop,
  }
}
