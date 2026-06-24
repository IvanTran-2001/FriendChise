-- CreateTable
CREATE TABLE "DemoSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "orgId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemoSession_userId_idx" ON "DemoSession"("userId");

-- CreateIndex
CREATE INDEX "DemoSession_orgId_idx" ON "DemoSession"("orgId");

-- CreateIndex
CREATE INDEX "DemoSession_createdAt_idx" ON "DemoSession"("createdAt");

-- CreateIndex
CREATE INDEX "DemoSession_expiresAt_idx" ON "DemoSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "DemoSession" ADD CONSTRAINT "DemoSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoSession" ADD CONSTRAINT "DemoSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
