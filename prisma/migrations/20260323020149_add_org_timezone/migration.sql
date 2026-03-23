/*
  Warnings:

  - Made the column `templateDays` on table `TimetableTemplate` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
UPDATE "TimetableTemplate"
SET "templateDays" = 7
WHERE "templateDays" IS NULL;
ALTER TABLE "TimetableTemplate" ALTER COLUMN "templateDays" SET NOT NULL,
ALTER COLUMN "title" DROP DEFAULT;
