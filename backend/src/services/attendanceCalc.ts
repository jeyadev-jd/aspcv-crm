import prisma from '../lib/prisma'
import { notifyRoles } from './notify'

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export type LogAction = 'CheckIn' | 'CheckOut' | 'BreakIn' | 'BreakOut' | 'TravelIn' | 'TravelOut'

export const LOG_ACTIONS: LogAction[] = ['CheckIn', 'CheckOut', 'BreakIn', 'BreakOut', 'TravelIn', 'TravelOut']

export function dayStartIST(d = new Date()): Date {
  const ist = new Date(d.getTime() + IST_OFFSET_MS)
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()))
}

/**
 * A date counts as non-working when it falls on a configured weekly off or on an
 * active entry in the holiday calendar. Working one of these earns a comp-off.
 */
export async function isNonWorkingDay(date: Date): Promise<boolean> {
  const settings = await prisma.attendanceSettings.findFirst({ where: { isActive: true } })
  const weeklyOff: string[] = Array.isArray(settings?.weeklyOff)
    ? (settings!.weeklyOff as string[])
    : ['Sunday']

  const dayName = DAY_NAMES[new Date(date.getTime() + IST_OFFSET_MS).getUTCDay()] as string
  if (weeklyOff.includes(dayName)) return true

  const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000)
  const holiday = await prisma.holidayCalendar.findFirst({
    where: { isActive: true, isOptional: false, date: { gte: date, lt: dayEnd } },
  })
  return Boolean(holiday)
}

/**
 * Walks the day's append-only punch trail and totals paired intervals.
 * An unclosed pair (e.g. TravelIn with no TravelOut yet) is ignored rather than
 * run to "now", so a partial day never inflates hours.
 */
function pairedHours(
  logs: { action: string; timestamp: Date }[],
  openAction: LogAction,
  closeAction: LogAction,
  openEndsAt: Date | null
): number {
  let total = 0
  let openedAt: Date | null = null
  for (const log of logs) {
    if (log.action === openAction && openedAt === null) openedAt = log.timestamp
    else if (log.action === closeAction && openedAt !== null) {
      total += log.timestamp.getTime() - openedAt.getTime()
      openedAt = null
    }
  }
  // An interval still open (checked in, on break, travelling) runs to `openEndsAt`
  // so today's dashboard ticks up live instead of reading 0h until checkout. For a
  // past day nothing is passed, and an unclosed interval simply contributes nothing.
  if (openedAt !== null && openEndsAt && openEndsAt > openedAt) {
    total += openEndsAt.getTime() - openedAt.getTime()
  }
  return total / (1000 * 60 * 60)
}

export type DayTotals = {
  totalWorkingHours: number
  totalTravelHours: number
  overtimeHours: number
  breakMinutes: number
  isOvertime: boolean
}

/**
 * Recomputes the day's rollup from its logs. Working time is
 * (checked-in span − breaks), capped at the configured full day; anything above
 * that cap becomes overtime rather than inflating core hours. Travel is tracked
 * separately and does not count toward the working-hours cap.
 */
export async function recomputeDayTotals(attendanceRecordId: string): Promise<DayTotals> {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceRecordId },
    select: { date: true },
  })
  const logs = await prisma.attendanceLog.findMany({
    where: { attendanceRecordId },
    orderBy: { timestamp: 'asc' },
    select: { action: true, timestamp: true },
  })

  const settings = await prisma.attendanceSettings.findFirst({ where: { isActive: true } })
  const fullDayHours = settings?.fullDayHours ?? 8

  // Only the day in progress accrues against the clock; a finished day is measured
  // purely by the pairs it actually recorded.
  const isToday = record ? record.date.getTime() === dayStartIST().getTime() : false
  const openEndsAt = isToday ? new Date() : null

  const grossHours = pairedHours(logs, 'CheckIn', 'CheckOut', openEndsAt)
  const breakHours = pairedHours(logs, 'BreakIn', 'BreakOut', openEndsAt)
  const travelHours = pairedHours(logs, 'TravelIn', 'TravelOut', openEndsAt)

  const netHours = Math.max(0, grossHours - breakHours)
  const totalWorkingHours = Math.min(netHours, fullDayHours)
  const overtimeHours = Math.max(0, netHours - fullDayHours)

  const totals: DayTotals = {
    totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
    totalTravelHours: Math.round(travelHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    breakMinutes: Math.round(breakHours * 60),
    isOvertime: overtimeHours > 0,
  }

  await prisma.attendanceRecord.update({
    where: { id: attendanceRecordId },
    data: {
      totalWorkingHours: totals.totalWorkingHours,
      totalTravelHours: totals.totalTravelHours,
      overtimeHours: totals.overtimeHours,
      breakMinutes: totals.breakMinutes,
      isOvertime: totals.isOvertime,
    },
  })

  return totals
}

/**
 * Grants one comp-off day for working a holiday/weekly-off, and alerts HR.
 * Idempotent per day: the attendance record's `isHoliday` flag is set by the
 * caller only on first check-in, so this runs once.
 */
export async function grantCompOff(userId: string, date: Date, reason: string): Promise<void> {
  const compOffType = await prisma.leaveType.findFirst({
    where: {
      isActive: true,
      OR: [
        { code: { in: ['CO', 'COMP_OFF'], mode: 'insensitive' } },
        { name: { contains: 'comp', mode: 'insensitive' } },
      ],
    },
  })

  if (compOffType) {
    const year = date.getUTCFullYear()
    const existing = await prisma.leaveBalance.findUnique({
      where: { userId_leaveTypeId_year: { userId, leaveTypeId: compOffType.id, year } },
    })
    if (existing) {
      await prisma.leaveBalance.update({
        where: { id: existing.id },
        data: { accrued: { increment: 1 }, balance: { increment: 1 } },
      })
    } else {
      await prisma.leaveBalance.create({
        data: { userId, leaveTypeId: compOffType.id, year, accrued: 1, balance: 1 },
      })
    }
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  await notifyRoles(['HR', 'SuperAdmin'], {
    type: 'comp_off_granted',
    severity: 'info',
    title: 'Comp-off granted',
    message: `${user?.name ?? 'An employee'} worked on ${date.toISOString().slice(0, 10)} (${reason}). 1 comp-off day credited.`,
    entityType: 'AttendanceRecord',
    entityId: userId,
  })
}
