-- AlterEnum
ALTER TYPE "FaultType" ADD VALUE 'TEC_ERROR';

-- DropIndex
DROP INDEX "ManufacturingOrder_quotationId_key";

-- CreateIndex
CREATE INDEX "ManufacturingOrder_quotationId_idx" ON "ManufacturingOrder"("quotationId");
