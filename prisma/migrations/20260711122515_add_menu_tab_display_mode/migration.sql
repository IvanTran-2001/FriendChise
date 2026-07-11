-- CreateEnum
CREATE TYPE "MenuTabDisplayMode" AS ENUM ('CARDS', 'LIST');

-- AlterTable
ALTER TABLE "MenuTab" ADD COLUMN     "displayMode" "MenuTabDisplayMode" NOT NULL DEFAULT 'CARDS';
