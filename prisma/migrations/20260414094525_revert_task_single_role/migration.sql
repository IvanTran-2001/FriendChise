/*
  Warnings:

  - You are about to drop the column `roleId` on the `Task` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_roleId_fkey";

-- DropIndex
DROP INDEX "Task_roleId_idx";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "roleId";

-- CreateTable
CREATE TABLE "TaskEligibility" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "TaskEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskEligibility_taskId_idx" ON "TaskEligibility"("taskId");

-- CreateIndex
CREATE INDEX "TaskEligibility_roleId_idx" ON "TaskEligibility"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskEligibility_taskId_roleId_key" ON "TaskEligibility"("taskId", "roleId");

-- AddForeignKey
ALTER TABLE "TaskEligibility" ADD CONSTRAINT "TaskEligibility_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEligibility" ADD CONSTRAINT "TaskEligibility_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
