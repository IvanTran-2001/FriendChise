import crypto from "crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/platform/prisma";

import { DEMO_GLOBAL_TASK_HARD_CAP, DEMO_GLOBAL_TASK_SOFT_CAP, DEMO_LIMITS, DEMO_MAX_CONCURRENT, DEMO_TTL_MS, isDemoEmail } from "./config";
import { cleanupExpiredDemos, withDemoProvisionLock } from "./helpers";
import { seedDemoOrg } from "./seed-demo-org";

export type DemoProvisionErrorCode = "demo_capacity" | "demo_high_load";

export class DemoProvisionError extends Error {
  code: DemoProvisionErrorCode;

  constructor(code: DemoProvisionErrorCode, message: string) {
    super(message);
    this.name = "DemoProvisionError";
    this.code = code;
  }
}

/**
 * Checks whether a demo user has hit a per-entity resource limit.
 */
export async function checkDemoLimit(
  userEmail: string | null | undefined,
  type: "task" | "member" | "org",
  orgId?: string,
  userId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!userEmail || !isDemoEmail(userEmail)) return { ok: true };

  if (type === "task" && orgId) {
    const count = await prisma.task.count({ where: { orgId } });
    if (count >= DEMO_LIMITS.PER_ORG_TASKS) {
      return { ok: false, error: `Demo orgs are limited to ${DEMO_LIMITS.PER_ORG_TASKS} tasks.` };
    }
  } else if (type === "member" && orgId) {
    const count = await prisma.membership.count({ where: { orgId } });
    if (count >= DEMO_LIMITS.PER_ORG_MEMBERS) {
      return { ok: false, error: `Demo orgs are limited to ${DEMO_LIMITS.PER_ORG_MEMBERS} members.` };
    }
  } else if (type === "org" && userId) {
    const count = await prisma.organization.count({ where: { ownerId: userId } });
    if (count >= DEMO_LIMITS.PER_USER_ORGS) {
      return { ok: false, error: `Demo accounts are limited to ${DEMO_LIMITS.PER_USER_ORGS} organizations.` };
    }
  }

  return { ok: true };
}

export async function prepareDemoSession(): Promise<{ userId: string; orgId: string }> {
  await cleanupExpiredDemos(prisma);
  const result = await withDemoProvisionLock(async () => {
    return prisma.$transaction(async (tx) => {
      const globalTaskCount = await tx.task.count({ where: { organization: { owner: { email: { endsWith: "@demo.friendchise.app" } } } } });
      if (globalTaskCount >= DEMO_GLOBAL_TASK_SOFT_CAP) {
        await cleanupExpiredDemos(tx, true);
        const rechecked = await tx.task.count({ where: { organization: { owner: { email: { endsWith: "@demo.friendchise.app" } } } } });
        if (rechecked >= DEMO_GLOBAL_TASK_HARD_CAP) {
          throw new DemoProvisionError("demo_high_load", "Demo is under high load. Please try again in 10 minutes.");
        }
      }

      const active = await tx.demoSession.count({
        where: {
          expiresAt: { gt: new Date() },
        },
      });
      if (active >= DEMO_MAX_CONCURRENT) {
        throw new DemoProvisionError("demo_capacity", "Demo capacity reached. Please try again in a few minutes.");
      }

      const demoId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const email = `demo-${demoId}@demo.friendchise.app`;
      const demoUser = await tx.user.create({ data: { email, name: "Demo User", image: "https://i.pravatar.cc/150?img=3" } });
      const orgId = await seedDemoOrg(demoUser.id, tx);
      await tx.demoSession.create({ data: { userId: demoUser.id, orgId, expiresAt: new Date(Date.now() + DEMO_TTL_MS) } });
      return { userId: demoUser.id, orgId };
    }, { timeout: 60_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });

  return result;
}
