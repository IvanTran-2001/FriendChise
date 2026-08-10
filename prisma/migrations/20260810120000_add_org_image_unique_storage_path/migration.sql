-- Remove duplicate OrgImage rows before adding the unique constraint.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "orgId", "storagePath"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "OrgImage"
)
DELETE FROM "OrgImage"
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE rn > 1
);

ALTER TABLE "OrgImage"
  ADD CONSTRAINT "OrgImage_orgId_storagePath_key" UNIQUE ("orgId", "storagePath");
