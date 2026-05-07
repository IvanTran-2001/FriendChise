/*
  Warnings:

  - You are about to drop the column `overrideQuantity` on the `ConversionTemplateEntry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ConversionTemplateEntry" DROP COLUMN "overrideQuantity",
ADD COLUMN     "pinnedOutput" DOUBLE PRECISION;
