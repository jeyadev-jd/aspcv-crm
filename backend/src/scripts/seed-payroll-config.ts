import prisma from '../lib/prisma'

/**
 * Seeds the statutory rates and Tamil Nadu professional tax slabs the payroll
 * engine reads. Idempotent - safe to re-run after a deploy.
 *
 * The rates mirror `Salary Model.xlsx`. PT is seeded as a single flat band
 * because the workbook uses a flat 208/month; the table shape supports real
 * half-yearly municipal slabs when management confirms them.
 */
async function main() {
  const config = await prisma.payrollStatutoryConfig.upsert({
    where: { version: 'xlsx-2026-06' },
    update: {},
    create: {
      version: 'xlsx-2026-06',
      effectiveFrom: new Date('2026-04-01'),
      pfWageCeiling: 15000,
      pfEmployeeRate: 0.12,
      pfEmployerRate: 0.12,
      pfCappedAmount: 1800,
      esiWageThreshold: 21000,
      esiEmployeeRate: 0.0075,
      esiEmployerRate: 0.0325,
      adminChargeRate: 0.005,
      edliChargeRate: 0.005,
      isActive: true,
    },
  })
  console.log('statutory config:', config.version)

  const existingSlabs = await prisma.professionalTaxSlab.count({ where: { state: 'Tamil Nadu' } })
  if (existingSlabs === 0) {
    // Flat 208/month as used throughout the workbook (column BA), applied from
    // the first rupee. Replace with banded slabs once confirmed.
    await prisma.professionalTaxSlab.create({
      data: { state: 'Tamil Nadu', minAmount: 0, maxAmount: null, amount: 208, isActive: true },
    })
    console.log('seeded Tamil Nadu PT: flat 208/month')
  } else {
    console.log('PT slabs already present:', existingSlabs)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
