-- AlterTable
ALTER TABLE "DemoSession" ADD COLUMN     "launchId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DemoSession_launchId_key" ON "DemoSession"("launchId");