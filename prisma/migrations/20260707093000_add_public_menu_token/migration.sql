-- AlterTable
ALTER TABLE "Menu" ADD COLUMN "publicToken" TEXT;

-- Backfill existing rows with opaque tokens before enforcing the invariant.
UPDATE "Menu"
SET "publicToken" = md5(random()::text || clock_timestamp()::text || "id"::text)
WHERE "publicToken" IS NULL;

-- Add the public token constraint after the backfill.
ALTER TABLE "Menu" ALTER COLUMN "publicToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Menu_publicToken_key" ON "Menu"("publicToken");
