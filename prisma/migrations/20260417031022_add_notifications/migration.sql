-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate partial unique index for pending invites
-- This index ensures that a user cannot have multiple pending invites for the same org and type
-- Note: This is a raw SQL index that prisma migrate may attempt to drop in future migrations
CREATE UNIQUE INDEX "invite_pending_unique" ON "Invite"("orgId", "recipientId", "type") WHERE "status" = 'PENDING';