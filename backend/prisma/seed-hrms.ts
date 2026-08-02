import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding HRMS data...')

  // ─── Attendance Settings ────────────────────────────────────────────────────
  await prisma.attendanceSettings.upsert({
    where: { id: 'default-settings' },
    update: {},
    create: {
      id: 'default-settings',
      officeStartTime: '09:00',
      officeEndTime: '18:00',
      gracePeriodMinutes: 15,
      halfDayHours: 4,
      fullDayHours: 8,
      weeklyOff: ['Sunday'],
      lateMarkAfterGrace: true,
      autoAbsentOnNoCheckIn: true,
      gpsRequired: false,
      gpsRadiusMeters: 200,
    },
  })
  console.log('  - Attendance settings created')

  // ─── Late-to-LOP Rules ───────────────────────────────────────────────────
  const lopRules = [
    { lateCount: 3, lopDays: 1 },
    { lateCount: 6, lopDays: 2 },
    { lateCount: 8, lopDays: 2.5 },
  ]
  for (const rule of lopRules) {
    await prisma.lateLopRule.upsert({
      where: { lateCount: rule.lateCount },
      update: { lopDays: rule.lopDays },
      create: rule,
    })
  }
  console.log('  - Late-to-LOP rules: 3→1, 6→2, 8→2.5')

  // ─── Leave Types ────────────────────────────────────────────────────────────
  const leaveTypes = [
    { code: 'AL', name: 'Annual Leave', annualQuota: 12, monthlyAccrual: 1, maxCarryForward: 30, isEncashable: true, maxEncashment: 15, sandwichApplicable: true, sortOrder: 1 },
    { code: 'CL', name: 'Casual Leave', annualQuota: 7, monthlyAccrual: 0, maxCarryForward: 0, isEncashable: false, sandwichApplicable: false, sortOrder: 2 },
    { code: 'SL', name: 'Sick Leave', annualQuota: 7, monthlyAccrual: 0, maxCarryForward: 0, isEncashable: false, requiresDocument: true, minDaysNotice: 0, sandwichApplicable: false, sortOrder: 3 },
    { code: 'ML', name: 'Maternity Leave', annualQuota: 182, monthlyAccrual: 0, maxCarryForward: 0, isPaidLeave: true, gender: 'Female', maxConsecutiveDays: 182, halfDayAllowed: false, sandwichApplicable: false, sortOrder: 4 },
    { code: 'PL', name: 'Paternity Leave', annualQuota: 15, monthlyAccrual: 0, maxCarryForward: 0, isPaidLeave: true, gender: 'Male', maxConsecutiveDays: 15, halfDayAllowed: false, sandwichApplicable: false, sortOrder: 5 },
    { code: 'CO', name: 'Comp Off', annualQuota: 0, monthlyAccrual: 0, maxCarryForward: 0, isEncashable: false, carryForwardExpiry: 90, sandwichApplicable: false, sortOrder: 6 },
    { code: 'OH', name: 'Optional Holiday', annualQuota: 2, monthlyAccrual: 0, maxCarryForward: 0, isEncashable: false, sandwichApplicable: false, sortOrder: 7 },
    { code: 'LWP', name: 'Leave Without Pay', annualQuota: 0, monthlyAccrual: 0, maxCarryForward: 0, isPaidLeave: false, sandwichApplicable: true, sortOrder: 8 },
  ]

  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {},
      create: lt as any,
    })
  }
  console.log(`  - ${leaveTypes.length} leave types created`)

  // ─── Salary Components ──────────────────────────────────────────────────────
  const components = [
    { code: 'BASIC', name: 'Basic Salary', type: 'earning', calculationType: 'percentage', percentageOf: 'gross', percentage: 50, isTaxable: true, sortOrder: 1 },
    { code: 'HRA', name: 'House Rent Allowance', type: 'earning', calculationType: 'percentage', percentageOf: 'basic', percentage: 50, isTaxable: true, sortOrder: 2 },
    { code: 'SA', name: 'Special Allowance', type: 'earning', calculationType: 'remainder', isTaxable: true, sortOrder: 3 },
    { code: 'PF_EE', name: 'Provident Fund (Employee)', type: 'deduction', calculationType: 'percentage', percentageOf: 'basic', percentage: 12, isStatutory: true, sortOrder: 10 },
    { code: 'PF_ER', name: 'Provident Fund (Employer)', type: 'employer', calculationType: 'percentage', percentageOf: 'basic', percentage: 12, isStatutory: true, sortOrder: 11 },
    { code: 'ESI_EE', name: 'ESI (Employee)', type: 'deduction', calculationType: 'percentage', percentageOf: 'gross', percentage: 0.75, isStatutory: true, sortOrder: 12 },
    { code: 'ESI_ER', name: 'ESI (Employer)', type: 'employer', calculationType: 'percentage', percentageOf: 'gross', percentage: 3.25, isStatutory: true, sortOrder: 13 },
    { code: 'PT', name: 'Professional Tax', type: 'deduction', calculationType: 'fixed', fixedAmount: 200, isStatutory: true, sortOrder: 14 },
    { code: 'TDS', name: 'Tax Deducted at Source', type: 'deduction', calculationType: 'slab', isStatutory: true, sortOrder: 15 },
  ]

  for (const comp of components) {
    await prisma.salaryComponent.upsert({
      where: { code: comp.code },
      update: {},
      create: comp as any,
    })
  }
  console.log(`  - ${components.length} salary components created`)

  // ─── Reimbursement Types ──────────────────────────────────────────────────
  const reimbTypes = [
    { code: 'TRAVEL', name: 'Travel Reimbursement', maxLimit: 50000 },
    { code: 'FUEL', name: 'Fuel Reimbursement', maxLimit: 10000 },
    { code: 'FOOD', name: 'Food Reimbursement', maxLimit: 5000 },
    { code: 'MEDICAL', name: 'Medical Reimbursement', maxLimit: 15000 },
    { code: 'OTHER', name: 'Other Reimbursement', maxLimit: null, requiresReceipt: true },
  ]

  for (const rt of reimbTypes) {
    await prisma.reimbursementType.upsert({
      where: { code: rt.code },
      update: {},
      create: rt as any,
    })
  }
  console.log(`  - ${reimbTypes.length} reimbursement types created`)

  // ─── 2026 Holiday Calendar (India) ────────────────────────────────────────
  const holidays2026 = [
    { name: 'Republic Day', date: '2026-01-26', type: 'national' },
    { name: 'Holi', date: '2026-03-04', type: 'public' },
    { name: 'Good Friday', date: '2026-04-03', type: 'public' },
    { name: 'Tamil New Year', date: '2026-04-14', type: 'regional' },
    { name: 'May Day', date: '2026-05-01', type: 'public' },
    { name: 'Independence Day', date: '2026-08-15', type: 'national' },
    { name: 'Ganesh Chaturthi', date: '2026-08-27', type: 'public' },
    { name: 'Mahatma Gandhi Jayanti', date: '2026-10-02', type: 'national' },
    { name: 'Dussehra', date: '2026-10-02', type: 'public' },
    { name: 'Diwali', date: '2026-10-21', type: 'public' },
    { name: 'Christmas', date: '2026-12-25', type: 'public' },
  ]

  for (const h of holidays2026) {
    const d = new Date(h.date)
    await prisma.holidayCalendar.upsert({
      where: { date_name: { date: d, name: h.name } },
      update: {},
      create: { name: h.name, date: d, type: h.type, year: 2026 },
    })
  }
  console.log(`  - ${holidays2026.length} holidays for 2026`)

  console.log('HRMS seed data complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
