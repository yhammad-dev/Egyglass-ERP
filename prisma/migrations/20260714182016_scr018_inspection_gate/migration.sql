/*
  Warnings:

  - You are about to drop the column `inspectionId` on the `inspection_measurements` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `inspection_measurements` table. All the data in the column will be lost.
  - You are about to drop the column `maxSpec` on the `inspection_measurements` table. All the data in the column will be lost.
  - You are about to drop the column `minSpec` on the `inspection_measurements` table. All the data in the column will be lost.
  - You are about to drop the column `recordedAt` on the `inspection_measurements` table. All the data in the column will be lost.
  - You are about to drop the column `recordedById` on the `inspection_measurements` table. All the data in the column will be lost.
  - You are about to drop the column `result` on the `inspection_measurements` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `inspection_measurements` table. All the data in the column will be lost.
  - Added the required column `createdById` to the `inspection_measurements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `inspection_measurements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `height` to the `inspection_measurements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `inspectionRequestId` to the `inspection_measurements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `width` to the `inspection_measurements` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `unit` on the `inspection_measurements` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AttachmentCategory" AS ENUM ('SITE_PHOTO', 'SKETCH', 'OTHER');

-- CreateEnum
CREATE TYPE "MeasurementUnit" AS ENUM ('SQM', 'CBM');

-- CreateEnum
CREATE TYPE "InspectionApprovalStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'RETURNED');

-- DropForeignKey
ALTER TABLE "inspection_measurements" DROP CONSTRAINT "inspection_measurements_inspectionId_fkey";

-- DropForeignKey
ALTER TABLE "inspection_measurements" DROP CONSTRAINT "inspection_measurements_recordedById_fkey";

-- DropIndex
DROP INDEX "inspection_measurements_inspectionId_idx";

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "category" "AttachmentCategory" NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "InspectionRequest" ADD COLUMN     "approvalStatus" "InspectionApprovalStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "returnReason" TEXT;

-- AlterTable
ALTER TABLE "inspection_measurements" DROP COLUMN "inspectionId",
DROP COLUMN "label",
DROP COLUMN "maxSpec",
DROP COLUMN "minSpec",
DROP COLUMN "recordedAt",
DROP COLUMN "recordedById",
DROP COLUMN "result",
DROP COLUMN "value",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "height" DECIMAL(12,3) NOT NULL,
ADD COLUMN     "inspectionRequestId" TEXT NOT NULL,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "width" DECIMAL(12,3) NOT NULL,
DROP COLUMN "unit",
ADD COLUMN     "unit" "MeasurementUnit" NOT NULL;

-- CreateIndex
CREATE INDEX "inspection_measurements_inspectionRequestId_idx" ON "inspection_measurements"("inspectionRequestId");

-- AddForeignKey
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_measurements" ADD CONSTRAINT "inspection_measurements_inspectionRequestId_fkey" FOREIGN KEY ("inspectionRequestId") REFERENCES "InspectionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_measurements" ADD CONSTRAINT "inspection_measurements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
