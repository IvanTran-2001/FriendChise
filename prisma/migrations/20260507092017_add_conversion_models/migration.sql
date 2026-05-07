-- CreateTable
CREATE TABLE "ToolItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionRate" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "fromItemId" TEXT NOT NULL,
    "toItemId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ConversionRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionTemplateEntry" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ConversionTemplateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionTemplateOutputVisibility" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ConversionTemplateOutputVisibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolItem_orgId_idx" ON "ToolItem"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolItem_orgId_name_key" ON "ToolItem"("orgId", "name");

-- CreateIndex
CREATE INDEX "ConversionSet_orgId_idx" ON "ConversionSet"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionSet_orgId_name_key" ON "ConversionSet"("orgId", "name");

-- CreateIndex
CREATE INDEX "ConversionRate_setId_idx" ON "ConversionRate"("setId");

-- CreateIndex
CREATE INDEX "ConversionRate_fromItemId_idx" ON "ConversionRate"("fromItemId");

-- CreateIndex
CREATE INDEX "ConversionRate_toItemId_idx" ON "ConversionRate"("toItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionRate_setId_fromItemId_toItemId_key" ON "ConversionRate"("setId", "fromItemId", "toItemId");

-- CreateIndex
CREATE INDEX "ConversionTemplate_setId_idx" ON "ConversionTemplate"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionTemplate_setId_name_key" ON "ConversionTemplate"("setId", "name");

-- CreateIndex
CREATE INDEX "ConversionTemplateEntry_templateId_idx" ON "ConversionTemplateEntry"("templateId");

-- CreateIndex
CREATE INDEX "ConversionTemplateEntry_itemId_idx" ON "ConversionTemplateEntry"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionTemplateEntry_templateId_itemId_key" ON "ConversionTemplateEntry"("templateId", "itemId");

-- CreateIndex
CREATE INDEX "ConversionTemplateOutputVisibility_templateId_idx" ON "ConversionTemplateOutputVisibility"("templateId");

-- CreateIndex
CREATE INDEX "ConversionTemplateOutputVisibility_itemId_idx" ON "ConversionTemplateOutputVisibility"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionTemplateOutputVisibility_templateId_itemId_key" ON "ConversionTemplateOutputVisibility"("templateId", "itemId");

-- AddForeignKey
ALTER TABLE "ToolItem" ADD CONSTRAINT "ToolItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionSet" ADD CONSTRAINT "ConversionSet_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionRate" ADD CONSTRAINT "ConversionRate_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ConversionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionRate" ADD CONSTRAINT "ConversionRate_fromItemId_fkey" FOREIGN KEY ("fromItemId") REFERENCES "ToolItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionRate" ADD CONSTRAINT "ConversionRate_toItemId_fkey" FOREIGN KEY ("toItemId") REFERENCES "ToolItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionTemplate" ADD CONSTRAINT "ConversionTemplate_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ConversionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionTemplateEntry" ADD CONSTRAINT "ConversionTemplateEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ConversionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionTemplateEntry" ADD CONSTRAINT "ConversionTemplateEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ToolItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionTemplateOutputVisibility" ADD CONSTRAINT "ConversionTemplateOutputVisibility_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ConversionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionTemplateOutputVisibility" ADD CONSTRAINT "ConversionTemplateOutputVisibility_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ToolItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
