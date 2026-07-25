/**
 * Seed/Backfill script to rename all existing task and tool item images to match their names.
 *
 * Safe to re-run.
 *
 * Run with:
 *   npx tsx scripts/seeds/rename-images.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { renameTaskImageIfNeeded, renameToolItemImageIfNeeded } from "@/lib/services/images";

const dbUrl = process.env.DATABASE_URL!;
if (!dbUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting image rename backfill/seed...");

  // 1. Rename Task images
  const tasks = await prisma.task.findMany({
    where: {
      imageUrl: { not: null },
    },
    select: { id: true, orgId: true, name: true, imageUrl: true },
  });

  // Filter tasks that have non-empty imageUrl
  const tasksToProcess = tasks.filter((t) => t.imageUrl && t.imageUrl.trim().length > 0);

  console.log(`Found ${tasksToProcess.length} tasks with images to check/rename.`);

  let taskSuccessCount = 0;
  let taskFailureCount = 0;

  for (const task of tasksToProcess) {
    try {
      const newPath = await renameTaskImageIfNeeded(task.orgId, task.id, prisma);
      if (newPath && newPath !== task.imageUrl) {
        console.log(`  Task "${task.name}" (${task.id}): Renamed image from "${task.imageUrl}" to "${newPath}"`);
        taskSuccessCount++;
      } else if (newPath) {
        console.log(`  Task "${task.name}" (${task.id}): Already matches expected path.`);
      } else {
        console.warn(`  Task "${task.name}" (${task.id}): Failed to rename/copy image.`);
        taskFailureCount++;
      }
    } catch (err) {
      console.error(`  Task "${task.name}" (${task.id}): Error during rename:`, err);
      taskFailureCount++;
    }
  }

  // 2. Rename ToolItem images
  const items = await prisma.toolItem.findMany({
    where: {
      imgUrl: { not: null },
    },
    select: { id: true, orgId: true, name: true, imgUrl: true },
  });

  const itemsToProcess = items.filter((i) => i.imgUrl && i.imgUrl.trim().length > 0);

  console.log(`Found ${itemsToProcess.length} tool items with images to check/rename.`);

  let itemSuccessCount = 0;
  let itemFailureCount = 0;

  for (const item of itemsToProcess) {
    try {
      const newPath = await renameToolItemImageIfNeeded(item.orgId, item.id, prisma);
      if (newPath && newPath !== item.imgUrl) {
        console.log(`  Item "${item.name}" (${item.id}): Renamed image from "${item.imgUrl}" to "${newPath}"`);
        itemSuccessCount++;
      } else if (newPath) {
        console.log(`  Item "${item.name}" (${item.id}): Already matches expected path.`);
      } else {
        console.warn(`  Item "${item.name}" (${item.id}): Failed to rename/copy image.`);
        itemFailureCount++;
      }
    } catch (err) {
      console.error(`  Item "${item.name}" (${item.id}): Error during rename:`, err);
      itemFailureCount++;
    }
  }

  console.log("\nImage rename backfill/seed completed:");
  console.log(`  Tasks: ${taskSuccessCount} renamed, ${taskFailureCount} failed.`);
  console.log(`  Items: ${itemSuccessCount} renamed, ${itemFailureCount} failed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
