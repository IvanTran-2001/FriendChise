/*
  Warnings:

  - Added the required column `orgName` to the `Invite` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "inviterName" TEXT,
ADD COLUMN     "orgName" TEXT,
ADD COLUMN     "seenAt" TIMESTAMP(3);

-- Backfill orgName from Organization table for existing invites
UPDATE "Invite"
SET "orgName" = "Organization"."name"
FROM "Organization"
WHERE "Invite"."orgId" = "Organization"."id" AND "Invite"."orgName" IS NULL;

-- Make orgName NOT NULL after backfill
ALTER TABLE "Invite" ALTER COLUMN "orgName" SET NOT NULL;