-- CreateEnum
CREATE TYPE "InspectionMatchResult" AS ENUM ('MATCHED', 'ACCEPTABLE_DEVIATION', 'REQUIRES_REPRICING');

-- AlterTable
ALTER TABLE "InspectionRequest" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "matchDeclaredAt" TIMESTAMP(3),
ADD COLUMN     "matchDeclaredById" TEXT,
ADD COLUMN     "matchReason" TEXT,
ADD COLUMN     "matchResult" "InspectionMatchResult",
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ALTER COLUMN "dueDate" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_matchDeclaredById_fkey" FOREIGN KEY ("matchDeclaredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
