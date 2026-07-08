-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Department" ADD VALUE 'PROCUREMENT';
ALTER TYPE "Department" ADD VALUE 'INSTALLATIONS';
ALTER TYPE "Department" ADD VALUE 'ACCOUNTING';
ALTER TYPE "Department" ADD VALUE 'HR';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'INSPECTION_REP';
