-- CreateEnum
CREATE TYPE "InstallationItemType" AS ENUM ('BREAKAGE_REPLACEMENT', 'MFG_ERROR', 'TEC_ERROR', 'MEASUREMENT_ERROR', 'CLIENT_DELAY', 'OTHER');

-- CreateTable
CREATE TABLE "installation_photos" (
    "id" TEXT NOT NULL,
    "installationOrderId" TEXT NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "caption" VARCHAR(300),
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installation_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installation_items" (
    "id" TEXT NOT NULL,
    "installationOrderId" TEXT NOT NULL,
    "type" "InstallationItemType" NOT NULL,
    "description" VARCHAR(500),
    "quantity" DECIMAL(10,2),
    "cost" DECIMAL(12,2),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "installation_photos_installationOrderId_idx" ON "installation_photos"("installationOrderId");

-- CreateIndex
CREATE INDEX "installation_items_installationOrderId_idx" ON "installation_items"("installationOrderId");

-- CreateIndex
CREATE INDEX "installation_items_type_idx" ON "installation_items"("type");

-- AddForeignKey
ALTER TABLE "installation_photos" ADD CONSTRAINT "installation_photos_installationOrderId_fkey" FOREIGN KEY ("installationOrderId") REFERENCES "InstallationOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_photos" ADD CONSTRAINT "installation_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_items" ADD CONSTRAINT "installation_items_installationOrderId_fkey" FOREIGN KEY ("installationOrderId") REFERENCES "InstallationOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_items" ADD CONSTRAINT "installation_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
