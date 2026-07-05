-- CreateEnum
CREATE TYPE "FactorMode" AS ENUM ('STANDARD', 'FIXED_AFTER', 'CUSTOM_FACTOR');

-- AlterTable
ALTER TABLE "ProductRecipe" ADD COLUMN     "customFactor" DECIMAL(4,2),
ADD COLUMN     "factorMode" "FactorMode" NOT NULL DEFAULT 'STANDARD';
