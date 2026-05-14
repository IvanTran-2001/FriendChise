/*
  SAFE RENAME MIGRATION — data is preserved via ALTER TABLE RENAME.

  Original Prisma-generated SQL used DROP TABLE + CREATE TABLE, which would
  destroy all TimetableTemplate data on production deploy. This has been
  rewritten to rename tables/constraints/indexes in place.

  ⚠️  Local dev note: if you already applied the old (DROP-based) version,
  your local _prisma_migrations checksum will mismatch. Run
  `pnpm prisma migrate reset` to resync your local DB from scratch.
*/

-- Rename tables (all rows are preserved)
ALTER TABLE "Template" RENAME TO "TimetableTemplate";
ALTER TABLE "TemplateEntry" RENAME TO "TimetableTemplateEntry";
ALTER TABLE "TemplateEntryAssignee" RENAME TO "TimetableTemplateEntryAssignee";

-- Rename primary key constraints
ALTER TABLE "TimetableTemplate" RENAME CONSTRAINT "Template_pkey" TO "TimetableTemplate_pkey";
ALTER TABLE "TimetableTemplateEntry" RENAME CONSTRAINT "TemplateEntry_pkey" TO "TimetableTemplateEntry_pkey";
ALTER TABLE "TimetableTemplateEntryAssignee" RENAME CONSTRAINT "TemplateEntryAssignee_pkey" TO "TimetableTemplateEntryAssignee_pkey";

-- Rename indexes
ALTER INDEX "Template_orgId_idx" RENAME TO "TimetableTemplate_orgId_idx";
ALTER INDEX "Template_name_orgId_key" RENAME TO "TimetableTemplate_name_orgId_key";
ALTER INDEX "TemplateEntryAssignee_membershipId_idx" RENAME TO "TimetableTemplateEntryAssignee_membershipId_idx";
ALTER INDEX "TemplateEntryAssignee_templateEntryId_membershipId_key" RENAME TO "TimetableTemplateEntryAssignee_templateEntryId_membershipId_key";

-- Rename foreign key constraints
ALTER TABLE "TimetableTemplate" RENAME CONSTRAINT "Template_orgId_fkey" TO "TimetableTemplate_orgId_fkey";
ALTER TABLE "TimetableTemplateEntry" RENAME CONSTRAINT "TemplateEntry_templateId_fkey" TO "TimetableTemplateEntry_templateId_fkey";
ALTER TABLE "TimetableTemplateEntry" RENAME CONSTRAINT "TemplateEntry_taskId_fkey" TO "TimetableTemplateEntry_taskId_fkey";
ALTER TABLE "TimetableTemplateEntryAssignee" RENAME CONSTRAINT "TemplateEntryAssignee_templateEntryId_fkey" TO "TimetableTemplateEntryAssignee_templateEntryId_fkey";
ALTER TABLE "TimetableTemplateEntryAssignee" RENAME CONSTRAINT "TemplateEntryAssignee_membershipId_fkey" TO "TimetableTemplateEntryAssignee_membershipId_fkey";

-- CreateTable (genuinely new — no existing data)
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

-- CreateTable (genuinely new — no existing data)
CREATE TABLE "RosterDayConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "recommendedSize" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RosterDayConfig_pkey" PRIMARY KEY ("id")
);

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
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterDayConfig" ADD CONSTRAINT "RosterDayConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

