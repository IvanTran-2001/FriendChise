-- CreateTable
CREATE TABLE "RosterTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterTemplateEntry" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "shiftStartMin" INTEGER,
    "shiftEndMin" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterTemplateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RosterTemplate_orgId_idx" ON "RosterTemplate"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterTemplate_orgId_name_key" ON "RosterTemplate"("orgId", "name");

-- CreateIndex
CREATE INDEX "RosterTemplateEntry_templateId_idx" ON "RosterTemplateEntry"("templateId");

-- CreateIndex
CREATE INDEX "RosterTemplateEntry_membershipId_idx" ON "RosterTemplateEntry"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterTemplateEntry_templateId_membershipId_dayIndex_key" ON "RosterTemplateEntry"("templateId", "membershipId", "dayIndex");

-- AddForeignKey
ALTER TABLE "RosterTemplate" ADD CONSTRAINT "RosterTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterTemplateEntry" ADD CONSTRAINT "RosterTemplateEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RosterTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterTemplateEntry" ADD CONSTRAINT "RosterTemplateEntry_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
