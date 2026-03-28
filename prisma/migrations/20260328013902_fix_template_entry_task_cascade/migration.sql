-- DropForeignKey
ALTER TABLE "TemplateEntry" DROP CONSTRAINT "TemplateEntry_taskId_fkey";

-- AddForeignKey
ALTER TABLE "TemplateEntry" ADD CONSTRAINT "TemplateEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
