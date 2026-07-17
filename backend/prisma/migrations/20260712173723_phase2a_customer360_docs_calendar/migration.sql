-- CreateEnum
CREATE TYPE "CalendarEventCategory" AS ENUM ('FollowUp', 'Meeting', 'Installation', 'Commissioning', 'EngineerVisit', 'WarrantyExpiry', 'AMCRenewal', 'ServiceVisit', 'CustomerReview', 'ProjectMilestone', 'Other');

-- CreateEnum
CREATE TYPE "CalendarEventSource" AS ENUM ('Manual', 'Auto');

-- CreateEnum
CREATE TYPE "CustomerHealthBand" AS ENUM ('Excellent', 'Good', 'Average', 'AtRisk', 'Critical');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('Proposal', 'Contract', 'DrawingDesign', 'Invoice', 'PurchaseOrder', 'WorkOrder', 'ServiceReport', 'Photo', 'Warranty', 'Other');

-- CreateEnum
CREATE TYPE "RelatedModule" AS ENUM ('Lead', 'Deal', 'Project', 'Procurement', 'Manufacturing', 'Installation', 'Finance', 'Service', 'Company', 'Discussion', 'Other');

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "documentType" "DocumentType",
ADD COLUMN     "relatedModule" "RelatedModule",
ADD COLUMN     "rootAttachmentId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "category" "CalendarEventCategory",
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "source" "CalendarEventSource" NOT NULL DEFAULT 'Manual';

-- CreateTable
CREATE TABLE "CustomerHealthSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "band" "CustomerHealthBand",
    "score" INTEGER,
    "factors" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerHealthSnapshot_companyId_computedAt_idx" ON "CustomerHealthSnapshot"("companyId", "computedAt");

-- CreateIndex
CREATE INDEX "Attachment_rootAttachmentId_idx" ON "Attachment"("rootAttachmentId");

-- CreateIndex
CREATE INDEX "CalendarEvent_entityType_entityId_idx" ON "CalendarEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "CalendarEvent_date_idx" ON "CalendarEvent"("date");

-- AddForeignKey
ALTER TABLE "CustomerHealthSnapshot" ADD CONSTRAINT "CustomerHealthSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_rootAttachmentId_fkey" FOREIGN KEY ("rootAttachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

