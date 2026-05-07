/*
  Warnings:

  - You are about to drop the `ConversionTemplateOutputVisibility` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ConversionTemplateOutputVisibility" DROP CONSTRAINT "ConversionTemplateOutputVisibility_itemId_fkey";

-- DropForeignKey
ALTER TABLE "ConversionTemplateOutputVisibility" DROP CONSTRAINT "ConversionTemplateOutputVisibility_templateId_fkey";

-- AlterTable
ALTER TABLE "ConversionTemplateEntry" ADD COLUMN     "overrideQuantity" DOUBLE PRECISION,
ADD COLUMN     "visible" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "quantity" DROP NOT NULL;

-- DropTable
DROP TABLE "ConversionTemplateOutputVisibility";
