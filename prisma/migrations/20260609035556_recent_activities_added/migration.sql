-- CreateTable
CREATE TABLE "RecentActivity" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityHref" TEXT,
    "lastUsedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecentActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecentActivity_orgId_category_lastUsedAt_idx" ON "RecentActivity"("orgId", "category", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecentActivity_orgId_category_entityKey_key" ON "RecentActivity"("orgId", "category", "entityKey");

-- AddForeignKey
ALTER TABLE "RecentActivity" ADD CONSTRAINT "RecentActivity_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
