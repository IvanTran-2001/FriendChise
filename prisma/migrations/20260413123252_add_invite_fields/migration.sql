-- AlterTable
ALTER TABLE "FranchiseToken" ADD COLUMN     "declinedAt" TIMESTAMP(3),
ADD COLUMN     "recipientId" TEXT;

-- CreateIndex
CREATE INDEX "FranchiseToken_recipientId_idx" ON "FranchiseToken"("recipientId");

-- AddForeignKey
ALTER TABLE "FranchiseToken" ADD CONSTRAINT "FranchiseToken_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
