/*
  Warnings:

  - Made the column `salesRequestType` on table `quotation_requests` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "quotation_requests" ALTER COLUMN "salesRequestType" SET NOT NULL;
