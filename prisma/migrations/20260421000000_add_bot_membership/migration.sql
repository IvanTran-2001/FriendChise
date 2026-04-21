-- Make userId optional to support bot memberships
ALTER TABLE "Membership" ALTER COLUMN "userId" DROP NOT NULL;

-- Add bot name field (populated when userId is null)
ALTER TABLE "Membership" ADD COLUMN "botName" TEXT;

-- Enforce exactly one of userId or botName (XOR constraint)
ALTER TABLE "Membership" ADD CONSTRAINT "membership_user_xor_bot"
  CHECK ((("userId" IS NULL) AND ("botName" IS NOT NULL)) OR (("userId" IS NOT NULL) AND ("botName" IS NULL)));