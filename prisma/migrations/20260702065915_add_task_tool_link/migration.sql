-- CreateTable
CREATE TABLE "TaskToolLink" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "toolPath" TEXT NOT NULL,
    "toolLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskToolLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskToolLink_orgId_idx" ON "TaskToolLink"("orgId");

-- CreateIndex
CREATE INDEX "TaskToolLink_taskId_idx" ON "TaskToolLink"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskToolLink_taskId_toolPath_key" ON "TaskToolLink"("taskId", "toolPath");

-- AddForeignKey
ALTER TABLE "TaskToolLink" ADD CONSTRAINT "TaskToolLink_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskToolLink" ADD CONSTRAINT "TaskToolLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
