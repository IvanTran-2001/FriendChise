/**
 * Backfills createdById and createdByName on all Task rows that don't have them.
 *
 * For each un-attributed task, sets the creator to the owner of the org that
 * owns the task (i.e. Organization.owner). This is the safest approximation
 * for tasks created before the createdBy fields were added.
 *
 * Safe to run in both dev and production:
 *  - Only touches rows where createdById IS NULL (never overwrites existing data).
 *  - Uses individual updates so a single failure doesn't roll back the whole run.
 *
 * Run with:
 *   npx tsx scripts/backfill-task-creators.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
if (!process.env.SKIP_DOTENV_LOCAL) {
  dotenv.config({ path: ".env.local", override: true, quiet: true });
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
  // Fetch all tasks that have no creator recorded yet, with their org owner.
  const tasks = await prisma.task.findMany({
    where: { createdById: null },
    select: {
      id: true,
      organization: {
        select: {
          owner: { select: { id: true, name: true } },
        },
      },
    },
  });

  console.log(`Found ${tasks.length} task(s) without a creator.`);
  if (tasks.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const task of tasks) {
    const owner = task.organization.owner;
    if (!owner) {
      console.warn(`  SKIP  task ${task.id} — org has no owner`);
      skipped++;
      continue;
    }

    try {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          createdById: owner.id,
          createdByName: owner.name,
        },
      });

      console.log(`  OK    task ${task.id} → ${owner.name ?? owner.id}`);
      updated++;
    } catch (err) {
      console.error(`  FAIL  task ${task.id} — ${err}`);
      failed++;
    }
  }

  console.log(
    `\nDone. Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
