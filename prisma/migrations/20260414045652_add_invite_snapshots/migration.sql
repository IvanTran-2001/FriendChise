/*
  Warnings:

  - Added the required column `orgName` to the `Invite` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "inviterName" TEXT,
ADD COLUMN     "orgName" TEXT NOT NULL,
ADD COLUMN     "seenAt" TIMESTAMP(3);
