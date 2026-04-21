-- Make userId optional to support bot memberships
ALTER TABLE "Membership" ALTER COLUMN "userId" DROP NOT NULL;

-- Add bot name field (populated when userId is null)
ALTER TABLE "Membership" ADD COLUMN "botName" TEXT;
