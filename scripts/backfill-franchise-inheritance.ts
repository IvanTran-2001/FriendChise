/**
 * Backfills TaskInheritance rows for all tasks and their connected orgs.
 *
 * Creates a TaskInheritance row for:
 *  1. The task's owning org (self-inheritance — mirrors createTask behaviour).
 *  2. Every direct child org of the owning org, for GLOBAL-scoped tasks
 *     (tasks that have been published and are visible to franchisees).
 *
 * All operations use skipDuplicates / upsert semantics — safe to re-run.
 *
 * Run in dev:
 *   npx tsx scripts/backfill-franchise-inheritance.ts
 *
 * Run in production:
 *   npx tsx scripts/backfill-franchise-inheritance.ts --confirm-production
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });

if (
  process.env.NODE_ENV === "production" &&
  !process.argv.includes("--confirm-production")
) {
  console.error(
    "Set NODE_ENV != production or pass --confirm-production to run against prod.",
  );
  process.exit(1);
}

import { PrismaClient, TaskScope } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const dbUrl = process.env.DATABASE_URL!;
if (!dbUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── 1. Self-inheritance: every task → owning org ──────────────────────────
  const allTasks = await prisma.task.findMany({
    select: { id: true, orgId: true, scope: true },
  });
  console.log(`Total tasks: ${allTasks.length}`);

  const CHUNK = 2000;
  let selfCreated = 0;
  for (let i = 0; i < allTasks.length; i += CHUNK) {
    const chunk = allTasks.slice(i, i + CHUNK);
    const { count } = await prisma.taskInheritance.createMany({
      data: chunk.map((t) => ({ taskId: t.id, orgId: t.orgId })),
      skipDuplicates: true,
    });
    selfCreated += count;
  }
  console.log(
    `Self-inheritance: ${selfCreated} created, ${allTasks.length - selfCreated} already existed.`,
  );

  // ── 2. Child-org inheritance: GLOBAL tasks → direct child orgs ────────────
  const globalTasks = allTasks.filter((t) => t.scope === TaskScope.GLOBAL);
  console.log(`\nGLOBAL tasks: ${globalTasks.length}`);

  if (globalTasks.length === 0) {
    console.log("No GLOBAL tasks — skipping child-org inheritance.");
    return;
  }

  // Map orgId → child org IDs (only for orgs that own at least one GLOBAL task)
  const ownerOrgIds = [...new Set(globalTasks.map((t) => t.orgId))];
  const childOrgs = await prisma.organization.findMany({
    where: { parentId: { in: ownerOrgIds } },
    select: { id: true, parentId: true },
  });

  // Group children by parentId for fast lookup
  const childrenByParent = new Map<string, string[]>();
  for (const child of childOrgs) {
    const list = childrenByParent.get(child.parentId!) ?? [];
    list.push(child.id);
    childrenByParent.set(child.parentId!, list);
  }

  console.log(
    `Child orgs found: ${childOrgs.length} across ${childrenByParent.size} parent org(s).`,
  );

  // Build all (taskId, childOrgId) pairs
  const pairs: { taskId: string; orgId: string }[] = [];
  for (const task of globalTasks) {
    const children = childrenByParent.get(task.orgId) ?? [];
    for (const childOrgId of children) {
      pairs.push({ taskId: task.id, orgId: childOrgId });
    }
  }

  console.log(`Candidate child-org inheritance pairs: ${pairs.length}`);

  let childCreated = 0;
  for (let i = 0; i < pairs.length; i += CHUNK) {
    const chunk = pairs.slice(i, i + CHUNK);
    const { count } = await prisma.taskInheritance.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    childCreated += count;
    console.log(
      `  Processed ${Math.min(i + CHUNK, pairs.length)}/${pairs.length} pairs (created ${count} in this chunk).`,
    );
  }

  console.log(
    `\nChild-org inheritance: ${childCreated} created, ${pairs.length - childCreated} already existed.`,
  );
  console.log(
    `\nDone. Total new TaskInheritance rows: ${selfCreated + childCreated}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
