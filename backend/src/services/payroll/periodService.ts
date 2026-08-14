import prisma from '../../lib/prisma'
import { PayrollPeriodStatus } from '@prisma/client'
import { calculatePayroll, toRecordData, PayrollValidationError } from './engine'
import { cycleWindow, daysInMonth, calendarDaysInCycle } from './period'

/**
 * Payroll period lifecycle: Draft -> Approved -> Paid, with Reopened creating a
 * new calculation version while the previous one is retained for audit.
 */

/** Creates the period if absent. Duplicate (month, year) is prevented by a unique index. */
export async function ensurePeriod(month: number, year: number, createdById?: string) {
  const existing = await prisma.payrollPeriod.findUnique({ where: { month_year: { month, year } } })
  if (existing) return existing

  const { cycleStart, cycleEnd } = cycleWindow(month, year)
  return prisma.payrollPeriod.create({
    data: {
      month,
      year,
      cycleStart,
      cycleEnd,
      calendarDays: calendarDaysInCycle(cycleStart, cycleEnd),
      daysInMonth: daysInMonth(month, year),
      createdById: createdById ?? null,
    },
  })
}

export interface RunOptions {
  monthlySpecial1?: number
  monthlySpecial2?: number
  employeeDeduction1?: number
  employeeDeduction2?: number
  tda?: number
  lopOverride?: number
}

/**
 * Calculates and persists one employee's payroll for a period.
 *
 * An approved period is immutable: re-running requires an explicit reopen,
 * which supersedes the previous version rather than overwriting it.
 */
export async function runForEmployee(
  userId: string,
  month: number,
  year: number,
  createdById?: string,
  options: RunOptions = {}
) {
  const period = await ensurePeriod(month, year, createdById)
  if (period.status === PayrollPeriodStatus.Approved || period.status === PayrollPeriodStatus.Paid) {
    throw new PayrollValidationError(
      `Payroll for ${month}/${year} is ${period.status.toLowerCase()} and cannot be recalculated. Reopen the period first.`
    )
  }

  const calc = await calculatePayroll(userId, month, year, options)
  const data = toRecordData(calc)

  // While the period is still a draft the current version is replaced in place;
  // versioning only kicks in once a run has been approved and reopened.
  const current = await prisma.payrollRecord.findFirst({
    where: { periodId: period.id, userId, isCurrent: true },
  })

  if (current) {
    return prisma.payrollRecord.update({ where: { id: current.id }, data })
  }
  return prisma.payrollRecord.create({
    data: { ...data, periodId: period.id, userId, version: 1, isCurrent: true },
  })
}

/** Runs payroll for every active employee who has a master salary configured. */
export async function runForAll(month: number, year: number, createdById?: string) {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })

  const results: { userId: string; name: string; status: 'ok' | 'skipped'; error?: string }[] = []
  for (const u of users) {
    try {
      await runForEmployee(u.id, month, year, createdById)
      results.push({ userId: u.id, name: u.name, status: 'ok' })
    } catch (err) {
      // One misconfigured employee must not abort the whole run.
      results.push({
        userId: u.id,
        name: u.name,
        status: 'skipped',
        error: err instanceof Error ? err.message : 'Calculation failed',
      })
    }
  }
  return results
}

/**
 * Freezes the period. Once approved the snapshot rows are the authoritative
 * figures - salary slips read from them, and later master-salary edits cannot
 * change them.
 */
export async function approvePeriod(month: number, year: number, approvedById: string) {
  const period = await prisma.payrollPeriod.findUnique({ where: { month_year: { month, year } } })
  if (!period) throw new PayrollValidationError('Payroll period not found')
  if (period.status === PayrollPeriodStatus.Approved || period.status === PayrollPeriodStatus.Paid) {
    throw new PayrollValidationError('This payroll period is already approved')
  }

  const count = await prisma.payrollRecord.count({ where: { periodId: period.id, isCurrent: true } })
  if (count === 0) throw new PayrollValidationError('No payroll records to approve — run the calculation first')

  return prisma.payrollPeriod.update({
    where: { id: period.id },
    data: { status: PayrollPeriodStatus.Approved, approvedById, approvedAt: new Date() },
  })
}

/**
 * Reopens an approved period for correction. The existing records are retained
 * as a superseded version (isCurrent = false) and fresh version rows are
 * created, so the audit history shows exactly what was approved before.
 */
export async function reopenPeriod(month: number, year: number, reopenedById: string) {
  const period = await prisma.payrollPeriod.findUnique({ where: { month_year: { month, year } } })
  if (!period) throw new PayrollValidationError('Payroll period not found')
  if (period.status === PayrollPeriodStatus.Paid) {
    throw new PayrollValidationError('A paid payroll period cannot be reopened')
  }
  if (period.status !== PayrollPeriodStatus.Approved) {
    throw new PayrollValidationError('Only an approved period can be reopened')
  }

  const currentRecords = await prisma.payrollRecord.findMany({
    where: { periodId: period.id, isCurrent: true },
  })

  await prisma.$transaction(async (tx) => {
    // Retire the approved version, then clone it forward at version + 1 so the
    // recalculation has a row to update and the old figures stay readable.
    await tx.payrollRecord.updateMany({
      where: { periodId: period.id, isCurrent: true },
      data: { isCurrent: false },
    })

    for (const rec of currentRecords) {
      const { id, createdAt, updatedAt, version, isCurrent, ...rest } = rec
      void id
      void createdAt
      void updatedAt
      void isCurrent
      await tx.payrollRecord.create({
        data: { ...rest, version: version + 1, isCurrent: true },
      })
    }

    await tx.payrollPeriod.update({
      where: { id: period.id },
      data: { status: PayrollPeriodStatus.Draft, approvedById: null, approvedAt: null, notes: `Reopened by ${reopenedById}` },
    })
  })

  return prisma.payrollPeriod.findUnique({ where: { id: period.id } })
}

export async function markPeriodPaid(month: number, year: number) {
  const period = await prisma.payrollPeriod.findUnique({ where: { month_year: { month, year } } })
  if (!period) throw new PayrollValidationError('Payroll period not found')
  if (period.status !== PayrollPeriodStatus.Approved) {
    throw new PayrollValidationError('Only an approved payroll period can be marked paid')
  }
  return prisma.payrollPeriod.update({
    where: { id: period.id },
    data: { status: PayrollPeriodStatus.Paid },
  })
}

/** The approved snapshot a salary slip must render, or null when unapproved. */
export async function getApprovedRecord(userId: string, month: number, year: number) {
  const period = await prisma.payrollPeriod.findUnique({ where: { month_year: { month, year } } })
  if (!period) return null
  if (period.status !== PayrollPeriodStatus.Approved && period.status !== PayrollPeriodStatus.Paid) {
    return null
  }
  return prisma.payrollRecord.findFirst({
    where: { periodId: period.id, userId, isCurrent: true },
    include: { period: true, adjustments: true },
  })
}
