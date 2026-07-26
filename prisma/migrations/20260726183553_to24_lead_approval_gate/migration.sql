-- CreateEnum
CREATE TYPE "LeadApprovalStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING_LEAD', 'LEAD_APPROVED', 'LEAD_RETURNED');

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "leadApprovalStatus" "LeadApprovalStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN     "leadDecidedAt" TIMESTAMP(3),
ADD COLUMN     "leadDecidedById" TEXT,
ADD COLUMN     "leadNote" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);
