-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('PRICING', 'EXECUTION');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'REVIEW';

-- AlterTable
ALTER TABLE "InspectionRequest" ADD COLUMN     "type" "InspectionType" NOT NULL DEFAULT 'PRICING';
