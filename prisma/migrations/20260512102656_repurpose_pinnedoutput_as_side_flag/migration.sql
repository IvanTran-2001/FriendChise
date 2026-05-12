/*
  Warnings:

  - You are about to drop the column `visible` on the `ConversionTemplateEntry` table. All the data in the column will be lost.
  - You are about to alter the column `pinnedOutput` on the `ConversionTemplateEntry` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - Made the column `pinnedOutput` on table `ConversionTemplateEntry` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill pinnedOutput from quantity:
--   quantity IS NOT NULL → from-side (1)
--   quantity IS NULL     → to-side   (2)
UPDATE "ConversionTemplateEntry"
SET "pinnedOutput" = CASE WHEN "quantity" IS NOT NULL THEN 1 ELSE 2 END
WHERE "pinnedOutput" IS NULL;

-- AlterTable
ALTER TABLE "ConversionTemplateEntry" DROP COLUMN "visible",
ALTER COLUMN "pinnedOutput" SET NOT NULL,
ALTER COLUMN "pinnedOutput" SET DEFAULT 0,
ALTER COLUMN "pinnedOutput" SET DATA TYPE INTEGER USING "pinnedOutput"::integer;
