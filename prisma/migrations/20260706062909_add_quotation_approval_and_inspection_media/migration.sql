-- CreateTable
CREATE TABLE "quotation_approvals" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "factor" DECIMAL(10,4) NOT NULL,
    "reason" TEXT,
    "decision" TEXT,
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "quotation_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_measurements" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "minSpec" DECIMAL(12,4),
    "maxSpec" DECIMAL(12,4),
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_photos" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "filename" VARCHAR(300) NOT NULL,
    "originalName" VARCHAR(300) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "caption" VARCHAR(500),
    "takenAt" TIMESTAMP(3),
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotation_approvals_quotationId_key" ON "quotation_approvals"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_approvals_quotationId_idx" ON "quotation_approvals"("quotationId");

-- CreateIndex
CREATE INDEX "inspection_measurements_inspectionId_idx" ON "inspection_measurements"("inspectionId");

-- CreateIndex
CREATE INDEX "inspection_photos_inspectionId_idx" ON "inspection_photos"("inspectionId");

-- AddForeignKey
ALTER TABLE "quotation_approvals" ADD CONSTRAINT "quotation_approvals_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_approvals" ADD CONSTRAINT "quotation_approvals_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_approvals" ADD CONSTRAINT "quotation_approvals_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_measurements" ADD CONSTRAINT "inspection_measurements_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "InspectionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_measurements" ADD CONSTRAINT "inspection_measurements_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "InspectionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
