-- AlterTable
ALTER TABLE "MenuTab" ADD COLUMN     "parentTabId" TEXT;

-- AddForeignKey
ALTER TABLE "MenuTab" ADD CONSTRAINT "MenuTab_parentTabId_fkey" FOREIGN KEY ("parentTabId") REFERENCES "MenuTab"("id") ON DELETE SET NULL ON UPDATE CASCADE;
