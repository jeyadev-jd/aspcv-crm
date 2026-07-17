-- CreateEnum
CREATE TYPE "LeadPipelineStage" AS ENUM ('Initial', 'QuestionnaireSent', 'QuestionnaireFollowUp', 'QuestionnaireValidation', 'TechnicalDiscussion', 'Costing', 'ProposalPreparation', 'ProposalSubmitted', 'Prospective', 'HighlyProspective', 'Negotiation', 'OrderWon', 'ProjectDropped');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "commercialModelId" TEXT,
ADD COLUMN     "regionId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "businessHeadId" TEXT,
ADD COLUMN     "capacityUnitId" TEXT,
ADD COLUMN     "capacityValue" DOUBLE PRECISION,
ADD COLUMN     "commercialModelId" TEXT,
ADD COLUMN     "leadNumber" TEXT,
ADD COLUMN     "leadSourceId" TEXT,
ADD COLUMN     "ownerAssignedAt" TIMESTAMP(3),
ADD COLUMN     "ownerChangedBy" TEXT,
ADD COLUMN     "pipelineStage" "LeadPipelineStage" NOT NULL DEFAULT 'Initial',
ADD COLUMN     "primaryOwnerId" TEXT,
ADD COLUMN     "regionId" TEXT,
ADD COLUMN     "salesManagerId" TEXT,
ADD COLUMN     "secondaryOwnerId" TEXT,
ADD COLUMN     "tempRangeMax" DOUBLE PRECISION,
ADD COLUMN     "tempRangeMin" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSourceMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadSourceMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReasonCode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "category" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReasonCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapacityUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolutionCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolutionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Solution" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Solution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolutionAccessory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolutionAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSolution" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "configuration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadSolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSolutionAccessory" (
    "id" TEXT NOT NULL,
    "leadSolutionId" TEXT NOT NULL,
    "accessoryId" TEXT NOT NULL,

    CONSTRAINT "LeadSolutionAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadStageHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "stage" "LeadPipelineStage" NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "changedBy" TEXT,

    CONSTRAINT "LeadStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_name_key" ON "Region"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialModel_name_key" ON "CommercialModel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSourceMaster_name_key" ON "LeadSourceMaster"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ReasonCode_name_key" ON "ReasonCode"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CapacityUnit_name_key" ON "CapacityUnit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SolutionCategory_name_key" ON "SolutionCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Solution_categoryId_name_key" ON "Solution"("categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SolutionAccessory_name_key" ON "SolutionAccessory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSolution_leadId_key" ON "LeadSolution"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSolutionAccessory_leadSolutionId_accessoryId_key" ON "LeadSolutionAccessory"("leadSolutionId", "accessoryId");

-- CreateIndex
CREATE INDEX "LeadStageHistory_leadId_idx" ON "LeadStageHistory"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_leadNumber_key" ON "Lead"("leadNumber");

-- CreateIndex
CREATE INDEX "Lead_pipelineStage_idx" ON "Lead"("pipelineStage");

-- CreateIndex
CREATE INDEX "Lead_regionId_idx" ON "Lead"("regionId");

-- CreateIndex
CREATE INDEX "Lead_commercialModelId_idx" ON "Lead"("commercialModelId");

-- AddForeignKey
ALTER TABLE "Solution" ADD CONSTRAINT "Solution_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SolutionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSolution" ADD CONSTRAINT "LeadSolution_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSolution" ADD CONSTRAINT "LeadSolution_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "Solution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSolutionAccessory" ADD CONSTRAINT "LeadSolutionAccessory_leadSolutionId_fkey" FOREIGN KEY ("leadSolutionId") REFERENCES "LeadSolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSolutionAccessory" ADD CONSTRAINT "LeadSolutionAccessory_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "SolutionAccessory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStageHistory" ADD CONSTRAINT "LeadStageHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_commercialModelId_fkey" FOREIGN KEY ("commercialModelId") REFERENCES "CommercialModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "LeadSourceMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_primaryOwnerId_fkey" FOREIGN KEY ("primaryOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_secondaryOwnerId_fkey" FOREIGN KEY ("secondaryOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_salesManagerId_fkey" FOREIGN KEY ("salesManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_businessHeadId_fkey" FOREIGN KEY ("businessHeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_capacityUnitId_fkey" FOREIGN KEY ("capacityUnitId") REFERENCES "CapacityUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_commercialModelId_fkey" FOREIGN KEY ("commercialModelId") REFERENCES "CommercialModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

