-- CreateEnum
CREATE TYPE "TecJobStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'ON_HOLD', 'DONE');

-- CreateEnum
CREATE TYPE "TechnicalRoute" AS ENUM ('PROJECTS', 'SOCIAL_MEDIA');

-- CreateEnum
CREATE TYPE "DrawingCategory" AS ENUM ('DRAWINGS', 'STRUCTURAL_CALC', 'DATA_SHEET', 'EXECUTION_DRAWINGS', 'APPROVALS');

-- CreateEnum
CREATE TYPE "DrawingFileType" AS ENUM ('PDF', 'DWG', 'JPG');

-- CreateEnum
CREATE TYPE "ExtraItemType" AS ENUM ('CHAMFER', 'WELDING', 'EXTRA_ACCESSORY', 'OUT_OF_CAIRO_TRANSPORT', 'SANDING');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'TECHNICAL_OFFICE';
ALTER TYPE "Role" ADD VALUE 'TEC_APPROVER';

-- CreateTable
CREATE TABLE "quotation_requests" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "status" "TecJobStatus" NOT NULL DEFAULT 'NEW',
    "technicalRoute" "TechnicalRoute" NOT NULL DEFAULT 'PROJECTS',
    "summary" TEXT,
    "notes" TEXT,
    "customerId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "inspectionRequestId" TEXT,
    "engineerId" TEXT,
    "salesOwnerId" TEXT,
    "inspectionOwnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "quotation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawings" (
    "id" TEXT NOT NULL,
    "category" "DrawingCategory" NOT NULL,
    "fileType" "DrawingFileType" NOT NULL,
    "filename" VARCHAR(300) NOT NULL,
    "originalName" VARCHAR(300) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "label" VARCHAR(200),
    "notes" TEXT,
    "revision" VARCHAR(20),
    "quotationRequestId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drawings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extra_items" (
    "id" TEXT NOT NULL,
    "type" "ExtraItemType" NOT NULL,
    "description" VARCHAR(500),
    "qty" DECIMAL(10,2),
    "unitCost" DECIMAL(12,2),
    "notes" TEXT,
    "manufacturingOrderId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extra_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotation_requests_code_key" ON "quotation_requests"("code");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_requests_quotationId_key" ON "quotation_requests"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_requests_inspectionRequestId_key" ON "quotation_requests"("inspectionRequestId");

-- CreateIndex
CREATE INDEX "quotation_requests_status_idx" ON "quotation_requests"("status");

-- CreateIndex
CREATE INDEX "quotation_requests_technicalRoute_idx" ON "quotation_requests"("technicalRoute");

-- CreateIndex
CREATE INDEX "quotation_requests_status_technicalRoute_idx" ON "quotation_requests"("status", "technicalRoute");

-- CreateIndex
CREATE INDEX "quotation_requests_customerId_idx" ON "quotation_requests"("customerId");

-- CreateIndex
CREATE INDEX "quotation_requests_engineerId_idx" ON "quotation_requests"("engineerId");

-- CreateIndex
CREATE INDEX "quotation_requests_inspectionRequestId_idx" ON "quotation_requests"("inspectionRequestId");

-- CreateIndex
CREATE INDEX "drawings_quotationRequestId_idx" ON "drawings"("quotationRequestId");

-- CreateIndex
CREATE INDEX "drawings_quotationRequestId_category_idx" ON "drawings"("quotationRequestId", "category");

-- CreateIndex
CREATE INDEX "drawings_approvedById_idx" ON "drawings"("approvedById");

-- CreateIndex
CREATE INDEX "extra_items_manufacturingOrderId_idx" ON "extra_items"("manufacturingOrderId");

-- CreateIndex
CREATE INDEX "extra_items_type_idx" ON "extra_items"("type");

-- AddForeignKey
ALTER TABLE "quotation_requests" ADD CONSTRAINT "quotation_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_requests" ADD CONSTRAINT "quotation_requests_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_requests" ADD CONSTRAINT "quotation_requests_inspectionRequestId_fkey" FOREIGN KEY ("inspectionRequestId") REFERENCES "InspectionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_requests" ADD CONSTRAINT "quotation_requests_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_requests" ADD CONSTRAINT "quotation_requests_salesOwnerId_fkey" FOREIGN KEY ("salesOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_requests" ADD CONSTRAINT "quotation_requests_inspectionOwnerId_fkey" FOREIGN KEY ("inspectionOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_quotationRequestId_fkey" FOREIGN KEY ("quotationRequestId") REFERENCES "quotation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_items" ADD CONSTRAINT "extra_items_manufacturingOrderId_fkey" FOREIGN KEY ("manufacturingOrderId") REFERENCES "ManufacturingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_items" ADD CONSTRAINT "extra_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
