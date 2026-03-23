-- Rename table: TaskCycle → TimetableTemplate
ALTER TABLE "TaskCycle" RENAME TO "TimetableTemplate";

-- Rename column on TimetableTemplate
ALTER TABLE "TimetableTemplate" RENAME COLUMN "cycleDays" TO "templateDays";

-- Add title column (default existing rows to 'Untitled')
ALTER TABLE "TimetableTemplate" ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Untitled';

-- Add effectiveFrom column (nullable — null means draft)
ALTER TABLE "TimetableTemplate" ADD COLUMN "effectiveFrom" TIMESTAMP(3);

-- Set default for templateDays
ALTER TABLE "TimetableTemplate" ALTER COLUMN "templateDays" SET DEFAULT 7;

-- Rename column on TaskInstance
ALTER TABLE "TaskInstance" RENAME COLUMN "cycleId" TO "templateId";

-- Add template-relative position columns to TaskInstance
ALTER TABLE "TaskInstance" ADD COLUMN "dayOffset" INTEGER;
ALTER TABLE "TaskInstance" ADD COLUMN "startTimeMin" INTEGER;
ALTER TABLE "TaskInstance"
  ADD CONSTRAINT "TaskInstance_dayOffset_check"
  CHECK ("dayOffset" IS NULL OR "dayOffset" >= 1);
ALTER TABLE "TaskInstance"
  ADD CONSTRAINT "TaskInstance_startTimeMin_check"
  CHECK ("startTimeMin" IS NULL OR ("startTimeMin" >= 0 AND "startTimeMin" <= 1439));

-- Add timezone to Organization
ALTER TABLE "Organization" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney';

-- Rename primary key constraint
ALTER TABLE "TimetableTemplate" RENAME CONSTRAINT "TaskCycle_pkey" TO "TimetableTemplate_pkey";

-- Rename foreign key constraints
ALTER TABLE "TimetableTemplate" RENAME CONSTRAINT "TaskCycle_orgId_fkey" TO "TimetableTemplate_orgId_fkey";
ALTER TABLE "TaskInstance" RENAME CONSTRAINT "TaskInstance_cycleId_fkey" TO "TaskInstance_templateId_fkey";

-- Rename indexes
ALTER INDEX "TaskCycle_orgId_idx" RENAME TO "TimetableTemplate_orgId_idx";
ALTER INDEX "TaskInstance_cycleId_idx" RENAME TO "TaskInstance_templateId_idx";
