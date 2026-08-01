ALTER TABLE "SystemSettings" ADD COLUMN "inspectionSlaInsideDays" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "SystemSettings" ADD COLUMN "inspectionSlaOutsideDays" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "InspectionRequest" ADD COLUMN "tecReceivedById" TEXT;
ALTER TABLE "InspectionRequest" ADD COLUMN "tecReceivedAt" TIMESTAMP(3);
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_tecReceivedById_fkey"
  FOREIGN KEY ("tecReceivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;