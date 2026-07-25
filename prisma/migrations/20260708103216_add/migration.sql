-- CreateTable
CREATE TABLE "MenuPreviewDailyView" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuPreviewDailyView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuPreviewDailyView_menuId_idx" ON "MenuPreviewDailyView"("menuId");

-- CreateIndex
CREATE INDEX "MenuPreviewDailyView_day_idx" ON "MenuPreviewDailyView"("day");

-- CreateIndex
CREATE UNIQUE INDEX "MenuPreviewDailyView_menuId_day_key" ON "MenuPreviewDailyView"("menuId", "day");

-- AddForeignKey
ALTER TABLE "MenuPreviewDailyView" ADD CONSTRAINT "MenuPreviewDailyView_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
