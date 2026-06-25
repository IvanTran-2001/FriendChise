-- CreateEnum
CREATE TYPE "AnnouncementScope" AS ENUM ('ORG', 'GLOBAL');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "scope" "AnnouncementScope" NOT NULL DEFAULT 'ORG';
