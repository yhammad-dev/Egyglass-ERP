CREATE TYPE "SiteReadiness" AS ENUM ('READY','NOT_READY','UNCONFIRMED');
CREATE TYPE "DeviationSource" AS ENUM ('CUSTOMER','INTERNAL');
CREATE TYPE "InspectionDeviationReason" AS ENUM ('CUSTOMER_POSTPONED','CUSTOMER_REJECTED','CUSTOMER_CANCELLED','UNSUITABLE_TIME','NO_STAFF_AVAILABLE','REMEASURE_REQUIRED','OTHER');
CREATE TYPE "InspectionReturnReason" AS ENUM ('MEASUREMENTS_INCOMPLETE','MEASUREMENTS_UNCLEAR','PHOTOS_MISSING','WRONG_LOCATION','OTHER');

ALTER TABLE "InspectionRequest" ALTER COLUMN "siteReadiness" TYPE "SiteReadiness"
  USING (CASE
    WHEN "siteReadiness" IS TRUE  THEN 'READY'::"SiteReadiness"
    WHEN "siteReadiness" IS FALSE THEN 'NOT_READY'::"SiteReadiness"
    ELSE NULL
  END);

ALTER TABLE "InspectionRequest"
  ADD COLUMN "deviationReason" "InspectionDeviationReason",
  ADD COLUMN "deviationNote" TEXT,
  ADD COLUMN "deviationRequestedBy" "DeviationSource",
  ADD COLUMN "deviationAt" TIMESTAMP(3),
  ADD COLUMN "deviationById" TEXT,
  ADD COLUMN "qualityFollowUp" BOOLEAN,
  ADD COLUMN "returnReasonCode" "InspectionReturnReason",
  ADD COLUMN "remeasureRequestedAt" TIMESTAMP(3),
  ADD COLUMN "remeasureRequestedById" TEXT,
  ADD COLUMN "remeasureReason" TEXT;

ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_deviationById_fkey"
  FOREIGN KEY ("deviationById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_remeasureRequestedById_fkey"
  FOREIGN KEY ("remeasureRequestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;