-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "milestoneId" TEXT;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "warrantyProjectsOnContract" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "warrantyProjectsOnQuotation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "warrantySocialOnQuotation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "warrantyTextProjects" TEXT,
ADD COLUMN     "warrantyTextSocialMedia" TEXT;

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "totalValue" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "payment_milestones" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "plannedAmount" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_milestones_contractId_idx" ON "payment_milestones"("contractId");

-- CreateIndex
CREATE INDEX "Payment_milestoneId_idx" ON "Payment"("milestoneId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "payment_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_milestones" ADD CONSTRAINT "payment_milestones_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
