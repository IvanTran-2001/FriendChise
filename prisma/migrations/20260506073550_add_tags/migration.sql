/*
  Warnings:

  - You are about to drop the `TaskTool` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tool` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TaskTool" DROP CONSTRAINT "TaskTool_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskTool" DROP CONSTRAINT "TaskTool_toolId_fkey";

-- DropForeignKey
ALTER TABLE "Tool" DROP CONSTRAINT "Tool_orgId_fkey";

-- DropIndex
DROP INDEX "TaskTag_taskId_idx";

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "TaskTool";

-- DropTable
DROP TABLE "Tool";
