-- CreateEnum
CREATE TYPE "CashbackStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "discountBasePct" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "discountMaxReqPct" DECIMAL(5,2) NOT NULL DEFAULT 25,
    "vatPct" DECIMAL(5,2) NOT NULL DEFAULT 14,
    "quotationValidDays" INTEGER NOT NULL DEFAULT 3,
    "cashbackActive" BOOLEAN NOT NULL DEFAULT true,
    "cashbackStartDate" TIMESTAMP(3),
    "companyLogoUrl" TEXT,
    "companyName" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashbackTier" (
    "id" TEXT NOT NULL,
    "orderFrom" INTEGER NOT NULL,
    "orderTo" INTEGER,
    "pct" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CashbackTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "newCustomerId" TEXT NOT NULL,
    "newQuotationId" TEXT NOT NULL,
    "referralOrder" INTEGER NOT NULL,
    "cashbackPct" DECIMAL(5,2) NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "cashbackAmount" DECIMAL(12,2) NOT NULL,
    "status" "CashbackStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "spec" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "Referral"("status");
