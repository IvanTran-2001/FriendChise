-- CreateTable
CREATE TABLE "OrgImage" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgImage_orgId_idx" ON "OrgImage"("orgId");

-- AddForeignKey
ALTER TABLE "OrgImage" ADD CONSTRAINT "OrgImage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
