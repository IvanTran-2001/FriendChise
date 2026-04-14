/*
  Warnings:

  - You are about to drop the `TaskEligibility` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TaskEligibility" DROP CONSTRAINT "TaskEligibility_roleId_fkey";

-- DropForeignKey
ALTER TABLE "TaskEligibility" DROP CONSTRAINT "TaskEligibility_taskId_fkey";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "roleId" TEXT;

-- DropTable
DROP TABLE "TaskEligibility";

-- CreateIndex
CREATE INDEX "Task_roleId_idx" ON "Task"("roleId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
