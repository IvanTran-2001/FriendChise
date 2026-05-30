-- CreateEnum
CREATE TYPE "ListDisplayType" AS ENUM ('TABLE', 'GRID', 'CHECKLIST', 'GALLERY');

-- CreateTable
CREATE TABLE "ToolItemList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orgId" TEXT NOT NULL,
    "displayType" "ListDisplayType" NOT NULL DEFAULT 'GRID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolItemList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolItemGridConfig" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "gridCols" INTEGER NOT NULL DEFAULT 4,
    "gridRows" INTEGER NOT NULL DEFAULT 4,

    CONSTRAINT "ToolItemGridConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolItemListEntry" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ToolItemListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolItemChecklistEntry" (
    "id" TEXT NOT NULL,
    "listEntryId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolItemChecklistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolItemList_orgId_idx" ON "ToolItemList"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolItemList_orgId_name_key" ON "ToolItemList"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ToolItemGridConfig_listId_key" ON "ToolItemGridConfig"("listId");

-- CreateIndex
CREATE INDEX "ToolItemListEntry_listId_idx" ON "ToolItemListEntry"("listId");

-- CreateIndex
CREATE INDEX "ToolItemListEntry_itemId_idx" ON "ToolItemListEntry"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolItemChecklistEntry_listEntryId_key" ON "ToolItemChecklistEntry"("listEntryId");

-- AddForeignKey
ALTER TABLE "ToolItemList" ADD CONSTRAINT "ToolItemList_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolItemGridConfig" ADD CONSTRAINT "ToolItemGridConfig_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ToolItemList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolItemListEntry" ADD CONSTRAINT "ToolItemListEntry_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ToolItemList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolItemListEntry" ADD CONSTRAINT "ToolItemListEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ToolItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolItemChecklistEntry" ADD CONSTRAINT "ToolItemChecklistEntry_listEntryId_fkey" FOREIGN KEY ("listEntryId") REFERENCES "ToolItemListEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
