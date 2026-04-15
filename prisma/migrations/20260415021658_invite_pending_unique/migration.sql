-- AddIndex
-- Enforces at most one PENDING invite per (org, recipient, type) tuple.
-- Uses a partial index so ACCEPTED / DECLINED rows remain unconstrained and
-- historical records are preserved.
CREATE UNIQUE INDEX "invite_pending_unique"
  ON "Invite" ("orgId", "recipientId", "type")
  WHERE ("status" = 'PENDING');