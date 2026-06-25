-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "broadcastKey" TEXT;
ALTER TABLE "Notification" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Notification_broadcastKey_key" ON "Notification"("broadcastKey");
CREATE INDEX "Notification_broadcastKey_idx" ON "Notification"("broadcastKey");