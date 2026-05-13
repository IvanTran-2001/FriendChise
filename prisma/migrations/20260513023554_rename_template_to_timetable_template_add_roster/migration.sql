/*
  Warnings:

  - You are about to drop the `Template` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TemplateEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TemplateEntryAssignee` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_orgId_fkey";

-- DropForeignKey
ALTER TABLE "TemplateEntry" DROP CONSTRAINT "TemplateEntry_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TemplateEntry" DROP CONSTRAINT "TemplateEntry_templateId_fkey";

-- DropForeignKey
ALTER TABLE "TemplateEntryAssignee" DROP CONSTRAINT "TemplateEntryAssignee_membershipId_fkey";

-- DropForeignKey
ALTER TABLE "TemplateEntryAssignee" DROP CONSTRAINT "TemplateEntryAssignee_templateEntryId_fkey";

-- DropTable
DROP TABLE "Template";

-- DropTable
DROP TABLE "TemplateEntry";

-- DropTable
DROP TABLE "TemplateEntryAssignee";

-- CreateTable
CREATE TABLE "TimetableTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "cycleLengthDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableTemplateEntry" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "durationMin" INTEGER,
    "dayIndex" INTEGER NOT NULL,
    "startTimeMin" INTEGER NOT NULL,
    "endTimeMin" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableTemplateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableTemplateEntryAssignee" (
    "id" TEXT NOT NULL,
    "templateEntryId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimetableTemplateEntryAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterDayConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "recommendedSize" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RosterDayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimetableTemplate_orgId_idx" ON "TimetableTemplate"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableTemplate_name_orgId_key" ON "TimetableTemplate"("name", "orgId");

-- CreateIndex
CREATE INDEX "TimetableTemplateEntryAssignee_membershipId_idx" ON "TimetableTemplateEntryAssignee"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableTemplateEntryAssignee_templateEntryId_membershipId_key" ON "TimetableTemplateEntryAssignee"("templateEntryId", "membershipId");

-- CreateIndex
CREATE INDEX "RosterEntry_orgId_weekStart_idx" ON "RosterEntry"("orgId", "weekStart");

-- CreateIndex
CREATE INDEX "RosterEntry_membershipId_idx" ON "RosterEntry"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterEntry_orgId_membershipId_weekStart_dayIndex_key" ON "RosterEntry"("orgId", "membershipId", "weekStart", "dayIndex");

-- CreateIndex
CREATE INDEX "RosterDayConfig_orgId_idx" ON "RosterDayConfig"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterDayConfig_orgId_dayIndex_key" ON "RosterDayConfig"("orgId", "dayIndex");

-- AddForeignKey
ALTER TABLE "TimetableTemplate" ADD CONSTRAINT "TimetableTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableTemplateEntry" ADD CONSTRAINT "TimetableTemplateEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TimetableTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableTemplateEntry" ADD CONSTRAINT "TimetableTemplateEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableTemplateEntryAssignee" ADD CONSTRAINT "TimetableTemplateEntryAssignee_templateEntryId_fkey" FOREIGN KEY ("templateEntryId") REFERENCES "TimetableTemplateEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableTemplateEntryAssignee" ADD CONSTRAINT "TimetableTemplateEntryAssignee_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterDayConfig" ADD CONSTRAINT "RosterDayConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
