-- CreateEnum
CREATE TYPE "SalesRequestType" AS ENUM ('INDIVIDUAL', 'SOCIAL_MEDIA', 'PROJECTS');

-- AlterTable
ALTER TABLE "quotation_requests" ADD COLUMN     "isReferralTag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salesRequestType" "SalesRequestType";

-- CreateIndex
CREATE INDEX "quotation_requests_salesRequestType_idx" ON "quotation_requests"("salesRequestType");
