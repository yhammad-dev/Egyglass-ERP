-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TEC_LEAD';

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "leadRoute" "TechnicalRoute";
