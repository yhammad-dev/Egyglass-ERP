-- CreateEnum
CREATE TYPE "FaultType" AS ENUM ('BREAKAGE', 'FACTORY_ERROR', 'MEASUREMENT_ERROR', 'CUSTOMER_DELAY');

-- CreateEnum
CREATE TYPE "DrawingStatus" AS ENUM ('DRAFT', 'TEC_APPROVED', 'INS_VERIFIED', 'CEO_APPROVED', 'RELEASED_TO_FACTORY', 'REJECTED');

-- AlterTable
ALTER TABLE "ManufacturingOrder" ADD COLUMN     "faultType" "FaultType",
ADD COLUMN     "parentOrderId" TEXT;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "ceoDrawingApprovalThreshold" DECIMAL(14,2),
ADD COLUMN     "managerApprovalCeilingPct" DECIMAL(5,2),
ADD COLUMN     "reviewGatePosition" INTEGER,
ADD COLUMN     "satisfactionSurveyDelayDays" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "drawings" ADD COLUMN     "status" "DrawingStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "extra_items" ADD COLUMN     "confirmedByInspection" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ManufacturingOrder_parentOrderId_idx" ON "ManufacturingOrder"("parentOrderId");

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "ManufacturingOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
