-- Remove duplicate OrgImage rows before adding the unique constraint.
WITH ranked AS (
  SELECT
    id,
    name,
    "orgId",
    "storagePath",
    "createdAt",
    ROW_NUMBER() OVER (
      PARTITION BY "orgId", "storagePath"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "OrgImage"
),
duplicate_names AS (
  SELECT DISTINCT ON ("orgId", "storagePath")
    "orgId",
    "storagePath",
    name
  FROM ranked
  WHERE rn > 1 AND name IS NOT NULL
  ORDER BY "orgId", "storagePath", "createdAt" ASC, "id" ASC
),
updated AS (
  UPDATE "OrgImage" target
  SET name = duplicate_names.name
  FROM ranked
  JOIN duplicate_names USING ("orgId", "storagePath")
  WHERE target.id = ranked.id
    AND ranked.rn = 1
    AND target.name IS NULL
  RETURNING target.id
)
DELETE FROM "OrgImage"
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE rn > 1
);


CREATE UNIQUE INDEX "OrgImage_orgId_storagePath_idx"
  ON "OrgImage" ("orgId", "storagePath");

ALTER TABLE "OrgImage"
  ADD CONSTRAINT "OrgImage_orgId_storagePath_key" UNIQUE USING INDEX "OrgImage_orgId_storagePath_idx";

DROP INDEX IF EXISTS "OrgImage_orgId_idx";
