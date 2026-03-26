/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Membership` table. All the data in the column will be lost.
  - You are about to drop the column `roleId` on the `Membership` table. All the data in the column will be lost.
  - You are about to drop the column `ownerUserId` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `peopleRequired` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `TaskEligibility` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `TaskEligibility` table. All the data in the column will be lost.
  - You are about to drop the `RolePermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TaskInstance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TaskInstanceAssignee` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TimetableTemplate` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,orgId]` on the table `Membership` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orgId,name]` on the table `Task` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Organization` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownerId` to the `Organization` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Role` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('MANAGE_MEMBERS', 'MANAGE_ROLES', 'MANAGE_TIMETABLE', 'MANAGE_TASKS', 'MANAGE_SETTINGS', 'MANAGE_FRANCHISE', 'VIEW_TIMETABLE');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ViewType" AS ENUM ('DAILY', 'WEEKLY');

-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_roleId_fkey";

-- DropForeignKey
ALTER TABLE "Organization" DROP CONSTRAINT "Organization_ownerUserId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "TaskInstance" DROP CONSTRAINT "TaskInstance_orgId_fkey";

-- DropForeignKey
ALTER TABLE "TaskInstance" DROP CONSTRAINT "TaskInstance_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskInstance" DROP CONSTRAINT "TaskInstance_templateId_fkey";

-- DropForeignKey
ALTER TABLE "TaskInstanceAssignee" DROP CONSTRAINT "TaskInstanceAssignee_membershipId_fkey";

-- DropForeignKey
ALTER TABLE "TaskInstanceAssignee" DROP CONSTRAINT "TaskInstanceAssignee_taskInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableTemplate" DROP CONSTRAINT "TimetableTemplate_orgId_fkey";

-- DropIndex
DROP INDEX "Membership_orgId_userId_key";

-- DropIndex
DROP INDEX "Organization_ownerUserId_idx";

-- DropIndex
DROP INDEX "Task_orgId_title_key";

-- AlterTable
ALTER TABLE "Membership" DROP COLUMN "createdAt",
DROP COLUMN "roleId",
ADD COLUMN     "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "workingDays" TEXT[];

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "ownerUserId",
DROP COLUMN "title",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "ownerId" TEXT NOT NULL,
ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "title",
ADD COLUMN     "color" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDeletable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "peopleRequired",
DROP COLUMN "title",
ADD COLUMN     "color" TEXT,
ADD COLUMN     "maxPeople" INTEGER,
ADD COLUMN     "minPeople" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "durationMin" SET DEFAULT 60;

-- AlterTable
ALTER TABLE "TaskEligibility" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";

-- DropTable
DROP TABLE "RolePermission";

-- DropTable
DROP TABLE "TaskInstance";

-- DropTable
DROP TABLE "TaskInstanceAssignee";

-- DropTable
DROP TABLE "TimetableTemplate";

-- DropEnum
DROP TYPE "OrgPermission";

-- DropEnum
DROP TYPE "TaskInstanceStatus";

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberRole" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "taskColor" TEXT,
    "taskDescription" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "durationMin" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTimeMin" INTEGER NOT NULL,
    "endTimeMin" INTEGER NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'TODO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableEntryAssignee" (
    "id" TEXT NOT NULL,
    "timetableEntryId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimetableEntryAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableSettings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "viewType" "ViewType" NOT NULL DEFAULT 'WEEKLY',
    "startDay" TEXT NOT NULL DEFAULT 'mon',
    "slotDuration" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "cycleLengthDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateEntry" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "durationMin" INTEGER,
    "dayIndex" INTEGER NOT NULL,
    "startTimeMin" INTEGER NOT NULL,
    "endTimeMin" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateEntryAssignee" (
    "id" TEXT NOT NULL,
    "templateEntryId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateEntryAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "usedByOrgId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FranchiseToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Permission_roleId_idx" ON "Permission"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_action_roleId_key" ON "Permission"("action", "roleId");

-- CreateIndex
CREATE INDEX "MemberRole_membershipId_idx" ON "MemberRole"("membershipId");

-- CreateIndex
CREATE INDEX "MemberRole_roleId_idx" ON "MemberRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberRole_membershipId_roleId_key" ON "MemberRole"("membershipId", "roleId");

-- CreateIndex
CREATE INDEX "TimetableEntry_orgId_idx" ON "TimetableEntry"("orgId");

-- CreateIndex
CREATE INDEX "TimetableEntry_taskId_idx" ON "TimetableEntry"("taskId");

-- CreateIndex
CREATE INDEX "TimetableEntry_orgId_date_idx" ON "TimetableEntry"("orgId", "date");

-- CreateIndex
CREATE INDEX "TimetableEntryAssignee_membershipId_idx" ON "TimetableEntryAssignee"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableEntryAssignee_timetableEntryId_membershipId_key" ON "TimetableEntryAssignee"("timetableEntryId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSettings_orgId_key" ON "TimetableSettings"("orgId");

-- CreateIndex
CREATE INDEX "Template_orgId_idx" ON "Template"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Template_name_orgId_key" ON "Template"("name", "orgId");

-- CreateIndex
CREATE INDEX "TemplateEntryAssignee_membershipId_idx" ON "TemplateEntryAssignee"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateEntryAssignee_templateEntryId_membershipId_key" ON "TemplateEntryAssignee"("templateEntryId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseToken_token_key" ON "FranchiseToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseToken_usedByOrgId_key" ON "FranchiseToken"("usedByOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE INDEX "Organization_ownerId_idx" ON "Organization"("ownerId");

-- CreateIndex
CREATE INDEX "Organization_parentId_idx" ON "Organization"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_orgId_name_key" ON "Task"("orgId", "name");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRole" ADD CONSTRAINT "MemberRole_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRole" ADD CONSTRAINT "MemberRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntryAssignee" ADD CONSTRAINT "TimetableEntryAssignee_timetableEntryId_fkey" FOREIGN KEY ("timetableEntryId") REFERENCES "TimetableEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntryAssignee" ADD CONSTRAINT "TimetableEntryAssignee_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSettings" ADD CONSTRAINT "TimetableSettings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateEntry" ADD CONSTRAINT "TemplateEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateEntry" ADD CONSTRAINT "TemplateEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateEntryAssignee" ADD CONSTRAINT "TemplateEntryAssignee_templateEntryId_fkey" FOREIGN KEY ("templateEntryId") REFERENCES "TemplateEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateEntryAssignee" ADD CONSTRAINT "TemplateEntryAssignee_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseToken" ADD CONSTRAINT "FranchiseToken_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
