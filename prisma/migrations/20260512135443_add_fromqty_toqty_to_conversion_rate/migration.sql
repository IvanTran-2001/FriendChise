-- AlterTable
ALTER TABLE "ConversionRate" ADD COLUMN "fromQty" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "toQty" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- Backfill: existing rows had fromQty=1 implicitly, so toQty = rate
UPDATE "ConversionRate" SET "fromQty" = 1, "toQty" = "rate";
