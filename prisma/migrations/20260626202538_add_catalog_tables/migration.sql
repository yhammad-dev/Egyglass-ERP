-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM ('GLASS', 'GLASS_ADDON_AREA', 'CHAMFER', 'SECTION', 'DOOR_SET', 'MACHINE', 'HANDLE', 'OPEN_CLOSE', 'ACCESSORY', 'TENSION', 'ELBOW', 'CEILING_STRIP', 'LATCH', 'SPIDER', 'OTHER');

-- CreateEnum
CREATE TYPE "MaterialUnit" AS ENUM ('SQM', 'LINEAR_M', 'PIECE', 'SET');

-- CreateEnum
CREATE TYPE "QtyRule" AS ENUM ('FIXED', 'BY_AREA', 'BY_LENGTH', 'BY_CONFIG', 'MANUAL');

-- CreateEnum
CREATE TYPE "CalcStrategy" AS ENUM ('SHOWER', 'RECIPE_FIXED');

-- CreateTable
CREATE TABLE "PricingFactor" (
    "id" TEXT NOT NULL,
    "value" DECIMAL(4,2) NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "category" "MaterialCategory" NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "unit" "MaterialUnit" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductType" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "calcStrategy" "CalcStrategy" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRecipe" (
    "id" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "materialId" TEXT,
    "qtyRule" "QtyRule" NOT NULL,
    "defaultQty" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigType" (
    "id" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sectionMod" DECIMAL(4,2) NOT NULL,
    "anglesCount" INTEGER NOT NULL,
    "openCloseCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_code_key" ON "ProductType"("code");

-- CreateIndex
CREATE INDEX "ProductRecipe_productTypeId_idx" ON "ProductRecipe"("productTypeId");

-- CreateIndex
CREATE INDEX "ConfigType_productTypeId_idx" ON "ConfigType"("productTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualItem_code_key" ON "ManualItem"("code");

-- AddForeignKey
ALTER TABLE "ProductRecipe" ADD CONSTRAINT "ProductRecipe_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecipe" ADD CONSTRAINT "ProductRecipe_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigType" ADD CONSTRAINT "ConfigType_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
