-- CreateEnum
CREATE TYPE "InstStatus" AS ENUM ('PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'INSTALLATIONS';

-- CreateTable
CREATE TABLE "InstallationOrder" (
    "id" TEXT NOT NULL,
    "manufacturingOrderId" TEXT NOT NULL,
    "teamLeadId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "status" "InstStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallationOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstallationOrder_manufacturingOrderId_key" ON "InstallationOrder"("manufacturingOrderId");

-- CreateIndex
CREATE INDEX "InstallationOrder_status_idx" ON "InstallationOrder"("status");

-- CreateIndex
CREATE INDEX "InstallationOrder_teamLeadId_idx" ON "InstallationOrder"("teamLeadId");

-- AddForeignKey
ALTER TABLE "InstallationOrder" ADD CONSTRAINT "InstallationOrder_manufacturingOrderId_fkey" FOREIGN KEY ("manufacturingOrderId") REFERENCES "ManufacturingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationOrder" ADD CONSTRAINT "InstallationOrder_teamLeadId_fkey" FOREIGN KEY ("teamLeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
