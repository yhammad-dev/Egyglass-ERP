-- CreateEnum
CREATE TYPE "InvestigationStatus" AS ENUM ('OPEN', 'JUDGED');

-- AlterEnum
ALTER TYPE "DrawingStatus" ADD VALUE 'SUPERSEDED';

-- CreateTable
CREATE TABLE "fault_investigations" (
    "id" TEXT NOT NULL,
    "manufacturingOrderId" TEXT NOT NULL,
    "installationItemId" TEXT NOT NULL,
    "claimedFault" "FaultType" NOT NULL,
    "verdictFault" "FaultType",
    "status" "InvestigationStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceNotes" TEXT,
    "verdictById" TEXT,
    "verdictAt" TIMESTAMP(3),
    "verdictNotes" TEXT,
    "replacementOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fault_investigations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fault_investigations_installationItemId_key" ON "fault_investigations"("installationItemId");

-- CreateIndex
CREATE UNIQUE INDEX "fault_investigations_replacementOrderId_key" ON "fault_investigations"("replacementOrderId");

-- CreateIndex
CREATE INDEX "fault_investigations_status_idx" ON "fault_investigations"("status");

-- CreateIndex
CREATE INDEX "fault_investigations_manufacturingOrderId_idx" ON "fault_investigations"("manufacturingOrderId");

-- AddForeignKey
ALTER TABLE "fault_investigations" ADD CONSTRAINT "fault_investigations_manufacturingOrderId_fkey" FOREIGN KEY ("manufacturingOrderId") REFERENCES "ManufacturingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fault_investigations" ADD CONSTRAINT "fault_investigations_replacementOrderId_fkey" FOREIGN KEY ("replacementOrderId") REFERENCES "ManufacturingOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fault_investigations" ADD CONSTRAINT "fault_investigations_installationItemId_fkey" FOREIGN KEY ("installationItemId") REFERENCES "installation_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fault_investigations" ADD CONSTRAINT "fault_investigations_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fault_investigations" ADD CONSTRAINT "fault_investigations_verdictById_fkey" FOREIGN KEY ("verdictById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
