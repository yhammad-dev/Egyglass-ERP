-- CreateEnum
CREATE TYPE "PostInstallStatus" AS ENUM ('PENDING', 'CONTACTED', 'RESOLVED', 'CLOSED');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "isVip" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "post_install_reviews" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "contractId" TEXT,
    "rating" INTEGER NOT NULL,
    "notes" TEXT,
    "issues" TEXT,
    "status" "PostInstallStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_install_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_install_reviews_customerId_idx" ON "post_install_reviews"("customerId");

-- CreateIndex
CREATE INDEX "post_install_reviews_status_idx" ON "post_install_reviews"("status");

-- AddForeignKey
ALTER TABLE "post_install_reviews" ADD CONSTRAINT "post_install_reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_install_reviews" ADD CONSTRAINT "post_install_reviews_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_install_reviews" ADD CONSTRAINT "post_install_reviews_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
