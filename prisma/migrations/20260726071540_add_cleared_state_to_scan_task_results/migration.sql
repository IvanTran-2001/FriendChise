-- AlterTable
ALTER TABLE "ScanTaskResult" ADD COLUMN     "clearedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ScanTaskResult_orgId_clearedAt_createdAt_idx" ON "ScanTaskResult"("orgId", "clearedAt", "createdAt");
