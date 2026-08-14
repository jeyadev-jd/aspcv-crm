-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('Draft', 'Approved', 'Reopened', 'Paid');

-- CreateEnum
CREATE TYPE "PayrollLifecycle" AS ENUM ('Joiner', 'Leaver', 'Stayer');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dorLetterDate" TIMESTAMP(3),
ADD COLUMN     "lastWorkingDate" TIMESTAMP(3),
ADD COLUMN     "masterBasic" DOUBLE PRECISION,
ADD COLUMN     "masterGross" DOUBLE PRECISION,
ADD COLUMN     "masterHra" DOUBLE PRECISION,
ADD COLUMN     "masterOthers" DOUBLE PRECISION,
ADD COLUMN     "masterSpecial1" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "masterSpecial2" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "priorExperienceMonths" INTEGER,
ADD COLUMN     "probationDays" INTEGER,
ADD COLUMN     "variablePayPa" DOUBLE PRECISION DEFAULT 0;

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "cycleStart" TIMESTAMP(3) NOT NULL,
    "cycleEnd" TIMESTAMP(3) NOT NULL,
    "calendarDays" INTEGER NOT NULL,
    "daysInMonth" INTEGER NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'Draft',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "lifecycle" "PayrollLifecycle" NOT NULL DEFAULT 'Stayer',
    "masterBasic" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masterHra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masterOthers" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masterSpecial1" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masterSpecial2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masterGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masterPfBasic" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masterCoPf" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masterForEsi" TEXT NOT NULL DEFAULT 'NO ESI',
    "masterEsiGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masterCoEsi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masterCtcPm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masterCtcPa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variablePayPa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masterCtcPaTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lop" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "daysForSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "daysPresent" INTEGER NOT NULL DEFAULT 0,
    "daysAbsent" INTEGER NOT NULL DEFAULT 0,
    "lateDays" INTEGER NOT NULL DEFAULT 0,
    "lateLopDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approvedLeaveDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "holidayDays" INTEGER NOT NULL DEFAULT 0,
    "weeklyOffDays" INTEGER NOT NULL DEFAULT 0,
    "monthlyBasic" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyHra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyOthers" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlySpecial1" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlySpecial2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossHra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employeePf" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employeeEsi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employeeTds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employeePt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employeeDeduction1" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employeeDeduction2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tda" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employerPf" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adminCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "edliCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employerEsi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEmployerCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustmentTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "configVersion" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "payrollRecordId" TEXT,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollStatutoryConfig" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "pfWageCeiling" DOUBLE PRECISION NOT NULL DEFAULT 15000,
    "pfEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
    "pfEmployerRate" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
    "pfCappedAmount" DOUBLE PRECISION NOT NULL DEFAULT 1800,
    "esiWageThreshold" DOUBLE PRECISION NOT NULL DEFAULT 21000,
    "esiEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0075,
    "esiEmployerRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0325,
    "adminChargeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.005,
    "edliChargeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.005,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollStatutoryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalTaxSlab" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'Tamil Nadu',
    "minAmount" DOUBLE PRECISION NOT NULL,
    "maxAmount" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalTaxSlab_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollPeriod_status_idx" ON "PayrollPeriod"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_month_year_key" ON "PayrollPeriod"("month", "year");

-- CreateIndex
CREATE INDEX "PayrollRecord_userId_idx" ON "PayrollRecord"("userId");

-- CreateIndex
CREATE INDEX "PayrollRecord_periodId_isCurrent_idx" ON "PayrollRecord"("periodId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_periodId_userId_version_key" ON "PayrollRecord"("periodId", "userId", "version");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_userId_month_year_idx" ON "PayrollAdjustment"("userId", "month", "year");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_payrollRecordId_idx" ON "PayrollAdjustment"("payrollRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollStatutoryConfig_version_key" ON "PayrollStatutoryConfig"("version");

-- CreateIndex
CREATE INDEX "PayrollStatutoryConfig_isActive_idx" ON "PayrollStatutoryConfig"("isActive");

-- CreateIndex
CREATE INDEX "ProfessionalTaxSlab_state_isActive_idx" ON "ProfessionalTaxSlab"("state", "isActive");

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_payrollRecordId_fkey" FOREIGN KEY ("payrollRecordId") REFERENCES "PayrollRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business-rule guards enforced at the database level so a bad write cannot
-- land even if it bypasses the API layer.
ALTER TABLE "PayrollRecord"
  ADD CONSTRAINT "PayrollRecord_lop_nonneg" CHECK ("lop" >= 0),
  ADD CONSTRAINT "PayrollRecord_daysForSalary_nonneg" CHECK ("daysForSalary" >= 0),
  ADD CONSTRAINT "PayrollRecord_masterGross_nonneg" CHECK ("masterGross" >= 0),
  ADD CONSTRAINT "PayrollRecord_monthlyGross_nonneg" CHECK ("monthlyGross" >= 0),
  ADD CONSTRAINT "PayrollRecord_version_positive" CHECK ("version" >= 1);

ALTER TABLE "PayrollPeriod"
  ADD CONSTRAINT "PayrollPeriod_month_range" CHECK ("month" BETWEEN 1 AND 12),
  ADD CONSTRAINT "PayrollPeriod_cycle_order" CHECK ("cycleEnd" > "cycleStart"),
  ADD CONSTRAINT "PayrollPeriod_days_positive" CHECK ("calendarDays" > 0 AND "daysInMonth" > 0);

-- DOJ must precede the last working day when both are set.
ALTER TABLE "User"
  ADD CONSTRAINT "User_doj_before_dol" CHECK (
    "joiningDate" IS NULL OR "lastWorkingDate" IS NULL OR "lastWorkingDate" >= "joiningDate"
  );

-- Only one current version per employee per period.
CREATE UNIQUE INDEX "PayrollRecord_period_user_current_key"
  ON "PayrollRecord" ("periodId", "userId") WHERE "isCurrent";
