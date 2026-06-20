-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'RETURNED');

-- CreateEnum
CREATE TYPE "QuotationType" AS ENUM ('INITIAL', 'FINAL');

-- CreateEnum
CREATE TYPE "DiscountRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ADJUSTED');

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "previousQuotationId" TEXT,
ADD COLUMN     "quotationType" "QuotationType" NOT NULL DEFAULT 'INITIAL',
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- CreateTable
CREATE TABLE "DiscountRequest" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "requestedPct" DECIMAL(5,2) NOT NULL,
    "approvedPct" DECIMAL(5,2),
    "status" "DiscountRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "DiscountRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscountRequest_quotationId_idx" ON "DiscountRequest"("quotationId");

-- CreateIndex
CREATE INDEX "DiscountRequest_status_idx" ON "DiscountRequest"("status");
