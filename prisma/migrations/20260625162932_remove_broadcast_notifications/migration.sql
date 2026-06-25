-- Clean up broadcast experiment rows before restoring the original shape.
DELETE FROM "Notification" WHERE "userId" IS NULL;

-- DropIndex
DROP INDEX IF EXISTS "Notification_broadcastKey_idx";
DROP INDEX IF EXISTS "Notification_broadcastKey_key";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN IF EXISTS "broadcastKey";
ALTER TABLE "Notification" ALTER COLUMN "userId" SET NOT NULL;