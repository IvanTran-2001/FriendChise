/*
  Warnings:

  - Made the column `color` on table `Role` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `Task` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Role" ALTER COLUMN "color" SET NOT NULL;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "color" SET NOT NULL;
