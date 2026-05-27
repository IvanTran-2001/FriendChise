/**
 * Backfills TaskInheritance rows based on org hierarchy.
 *
 * Rules:
 *  1. Every org self-inherits all of its own tasks.
 *  2. Every org that has a parent org inherits all tasks owned by that parent.
 *
 * Scope is intentionally ignored — all tasks are included regardless of whether
 * they are ORG / GLOBAL / FROZEN. Use this when you want every child org to see
 * every parent task.
 *
 * Safe to re-run — uses skipDuplicates throughout.
 *
 * Run in dev:
 *   npx tsx scripts/backfill-parent-task-inheritance.ts
 *
 * Run in production:
 *   npx tsx scripts/backfill-parent-task-inheritance.ts --confirm-production
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
if (!process.env.SKIP_DOTENV_LOCAL) {
  dotenv.config({ path: ".env.local", override: true, quiet: true });
}

if (
  process.env.NODE_ENV === "production" &&
  !process.argv.includes("--confirm-production")
) {
  console.error(
    "Set NODE_ENV != production or pass --confirm-production to run against prod.",
  );
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
  // Load all orgs (id + parentId) and all tasks (id + orgId)
  const [orgs, tasks] = await Promise.all([
    prisma.organization.findMany({ select: { id: true, parentId: true } }),
    prisma.task.findMany({ select: { id: true, orgId: true } }),
  ]);

  console.log(`Orgs: ${orgs.length}  |  Tasks: ${tasks.length}`);

  // Build map: orgId → taskIds owned by that org
  const tasksByOrg = new Map<string, string[]>();
  for (const task of tasks) {
    const list = tasksByOrg.get(task.orgId) ?? [];
    list.push(task.id);
    tasksByOrg.set(task.orgId, list);
  }

  // Collect all (taskId, orgId) pairs to create
  const pairs: { taskId: string; orgId: string }[] = [];

  for (const org of orgs) {
    // 1. Self-inherit: all tasks this org owns
    const ownTaskIds = tasksByOrg.get(org.id) ?? [];
    for (const taskId of ownTaskIds) {
      pairs.push({ taskId, orgId: org.id });
    }

    // 2. Parent-inherit: all tasks owned by this org's parent
    if (org.parentId) {
      const parentTaskIds = tasksByOrg.get(org.parentId) ?? [];
      for (const taskId of parentTaskIds) {
        pairs.push({ taskId, orgId: org.id });
      }
    }
  }

  // Deduplicate in-memory (same pair can appear from multiple orgs)
  const unique = [
    ...new Map(pairs.map((p) => [`${p.taskId}:${p.orgId}`, p])).values(),
  ];

  console.log(`Candidate inheritance pairs: ${unique.length}`);

  const CHUNK = 2000;
  let created = 0;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const { count } = await prisma.taskInheritance.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    created += count;
    console.log(
      `  Processed ${Math.min(i + CHUNK, unique.length)}/${unique.length} (created ${count} in this chunk).`,
    );
  }

  console.log(
    `\nDone. Created: ${created}, Already existed: ${unique.length - created}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
