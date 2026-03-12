/*
  Warnings:

  - You are about to drop the column `orgId` on the `TaskEligibility` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[orgId,key]` on the table `Role` will be added. If there are existing duplicate values, this will fail.
  - Made the column `roleId` on table `Membership` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ownerUserId` on table `Organization` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `key` to the `Role` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_roleId_fkey";

-- DropIndex
DROP INDEX "Organization_title_key";

-- DropIndex
DROP INDEX "Role_orgId_title_key";

-- DropIndex
DROP INDEX "TaskEligibility_orgId_idx";

-- AlterTable
ALTER TABLE "Role" ADD COLUMN "key" TEXT;
-- Backfill "Role"."key", and clean up any legacy NULL
-- "Membership"."roleId"/"Organization"."ownerUserId" rows here.
ALTER TABLE "Role" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "Membership" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "Organization" ALTER COLUMN "ownerUserId" SET NOT NULL;

-- AlterTable
ALTER TABLE "TaskEligibility" DROP COLUMN "orgId";

-- CreateIndex
CREATE INDEX "Organization_ownerUserId_idx" ON "Organization"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_orgId_key_key" ON "Role"("orgId", "key");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
