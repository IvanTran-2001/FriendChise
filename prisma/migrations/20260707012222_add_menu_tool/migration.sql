-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuTab" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuTab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "toolItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "calories" INTEGER,
    "notes" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuTabPlacement" (
    "id" TEXT NOT NULL,
    "menuTabId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "MenuTabPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Menu_orgId_idx" ON "Menu"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Menu_orgId_name_key" ON "Menu"("orgId", "name");

-- CreateIndex
CREATE INDEX "MenuTab_menuId_idx" ON "MenuTab"("menuId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuTab_menuId_name_key" ON "MenuTab"("menuId", "name");

-- CreateIndex
CREATE INDEX "MenuItem_menuId_idx" ON "MenuItem"("menuId");

-- CreateIndex
CREATE INDEX "MenuItem_toolItemId_idx" ON "MenuItem"("toolItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_menuId_toolItemId_key" ON "MenuItem"("menuId", "toolItemId");

-- CreateIndex
CREATE INDEX "MenuTabPlacement_menuTabId_idx" ON "MenuTabPlacement"("menuTabId");

-- CreateIndex
CREATE INDEX "MenuTabPlacement_menuItemId_idx" ON "MenuTabPlacement"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuTabPlacement_menuTabId_menuItemId_key" ON "MenuTabPlacement"("menuTabId", "menuItemId");

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuTab" ADD CONSTRAINT "MenuTab_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_toolItemId_fkey" FOREIGN KEY ("toolItemId") REFERENCES "ToolItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuTabPlacement" ADD CONSTRAINT "MenuTabPlacement_menuTabId_fkey" FOREIGN KEY ("menuTabId") REFERENCES "MenuTab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuTabPlacement" ADD CONSTRAINT "MenuTabPlacement_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
