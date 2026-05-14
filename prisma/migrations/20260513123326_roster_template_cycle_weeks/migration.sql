/*
  Warnings:

  - A unique constraint covering the columns `[templateId,membershipId,weekIndex,dayIndex]` on the table `RosterTemplateEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "RosterTemplateEntry_templateId_membershipId_dayIndex_key";

-- AlterTable
ALTER TABLE "RosterTemplate" ADD COLUMN     "cycleWeeks" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "RosterTemplateEntry" ADD COLUMN     "weekIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "RosterTemplateEntry_templateId_membershipId_weekIndex_dayIn_key" ON "RosterTemplateEntry"("templateId", "membershipId", "weekIndex", "dayIndex");
