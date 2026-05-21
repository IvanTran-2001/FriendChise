/**
 * Backfills TaskInheritance rows for every existing task.
 *
 * For each task, creates a TaskInheritance row linking the task to its owning
 * org — skipping any that already exist. This brings existing tasks in line
 * with the createTask behaviour that auto-creates inheritance on task creation.
 *
 * DEV ONLY — exits if NODE_ENV is production.
 *
 * Run with:
 *   npx tsx scripts/backfill-task-inheritance.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });

if (process.env.NODE_ENV === "production") {
  console.error("This script must not be run in production.");
  process.exit(1);
}

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const dbUrl = process.env.DATABASE_URL!;
if (!dbUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tasks = await prisma.task.findMany({ select: { id: true, orgId: true } });
  console.log(`Found ${tasks.length} tasks.`);

  const { count } = await prisma.taskInheritance.createMany({
    data: tasks.map((t) => ({ taskId: t.id, orgId: t.orgId })),
    skipDuplicates: true,
  });

  console.log(`Created ${count} new TaskInheritance rows (${tasks.length - count} already existed).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
