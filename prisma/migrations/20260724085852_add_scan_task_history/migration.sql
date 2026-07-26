-- CreateTable
CREATE TABLE "ScanTaskResult" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdById" TEXT,
    "batchId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKind" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "instruction" TEXT,
    "draft" JSONB,
    "error" TEXT,
    "metadata" JSONB,
    "taskId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanTaskResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanTaskResult_orgId_createdAt_idx" ON "ScanTaskResult"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "ScanTaskResult_orgId_batchId_idx" ON "ScanTaskResult"("orgId", "batchId");

-- CreateIndex
CREATE INDEX "ScanTaskResult_orgId_taskId_idx" ON "ScanTaskResult"("orgId", "taskId");

-- CreateIndex
CREATE INDEX "ScanTaskResult_orgId_createdById_idx" ON "ScanTaskResult"("orgId", "createdById");

-- AddForeignKey
ALTER TABLE "ScanTaskResult" ADD CONSTRAINT "ScanTaskResult_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanTaskResult" ADD CONSTRAINT "ScanTaskResult_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanTaskResult" ADD CONSTRAINT "ScanTaskResult_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
