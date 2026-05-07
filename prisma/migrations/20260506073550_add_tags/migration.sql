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
-- Archive any existing rows to _archive_* tables before dropping,
-- preventing silent data loss if the tables are non-empty.
-- The archive tables are intentionally left in place for manual review
-- and can be dropped once the team confirms no data recovery is needed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TaskTool" LIMIT 1) THEN
    CREATE TABLE IF NOT EXISTS "_archive_TaskTool" AS SELECT * FROM "TaskTool";
  END IF;
  IF EXISTS (SELECT 1 FROM "Tool" LIMIT 1) THEN
    CREATE TABLE IF NOT EXISTS "_archive_Tool" AS SELECT * FROM "Tool";
  END IF;
END $$;

DROP TABLE "TaskTool";

-- DropTable
DROP TABLE "Tool";
