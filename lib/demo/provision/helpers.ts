import { prisma } from "@/lib/platform/prisma";
import { localToUTC } from "@/lib/core/date-utils";
import { Prisma, TaskScope } from "@prisma/client";

import { DEMO_JWT_TTL_MS, DEMO_TTL_MS } from "./config";
import { FRANCHISEE_TASKS_SEED, TASKS_SEED } from "../data";
import type { FranchiseeTaskDef, TaskDef } from "../data";

let demoProvisionChain: Promise<void> = Promise.resolve();

export async function withDemoProvisionLock<T>(action: () => Promise<T>): Promise<T> {
  const previous = demoProvisionChain;
  let release!: () => void;
  demoProvisionChain = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await action();
  } finally {
    release();
  }
}

export type SeededTaskRow = Awaited<ReturnType<typeof prisma.task.createManyAndReturn>>[number];

type SeedCollection =
  | { model: typeof TASKS_SEED.model; data: ReadonlyArray<TaskDef> }
  | { model: typeof FRANCHISEE_TASKS_SEED.model; data: ReadonlyArray<FranchiseeTaskDef> };

export async function createSeedRows(
  tx: Prisma.TransactionClient,
  orgId: string,
  collection: SeedCollection,
): Promise<SeededTaskRow[]> {
  switch (collection.model) {
    case "task":
      return tx.task.createManyAndReturn({
        data: collection.data.map(([name, color, durationMin, description, , preferredStart, minWait, maxWait]) => ({
          orgId,
          name,
          color,
          durationMin,
          description,
          preferredStartTimeMin: timeToMin(preferredStart),
          minPeople: 1,
          minWaitDays: minWait,
          maxWaitDays: maxWait,
        })),
      });
    case "franchiseeTask":
      return tx.task.createManyAndReturn({
        data: collection.data.map(([name, color, durationMin, description, preferredStart, minWait, maxWait]) => ({
          orgId,
          name,
          color,
          durationMin,
          description,
          preferredStartTimeMin: timeToMin(preferredStart),
          minPeople: 1,
          minWaitDays: minWait,
          maxWaitDays: maxWait,
          scope: TaskScope.GLOBAL,
        })),
      });
  }
}

export function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function makeDateUtils(tz: string) {
  const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const [ty, tm, td] = todayLocal.split("-").map(Number);

  function localDateForOffset(offsetDays: number): string {
    const d = new Date(Date.UTC(ty, tm - 1, td + offsetDays));
    return d.toISOString().slice(0, 10);
  }

  function utcEntry(offsetDays: number, localHHMM: string, durationMin: number) {
    const { utcDate, utcStartTimeMin } = localToUTC(localDateForOffset(offsetDays), timeToMin(localHHMM), tz);
    return {
      date: utcDate,
      startTimeMin: utcStartTimeMin,
      endTimeMin: Math.min(utcStartTimeMin + durationMin, 1440),
    };
  }

  return { utcEntry };
}

export async function cleanupExpiredDemos(
  client: typeof prisma | Prisma.TransactionClient,
  aggressive = false,
) {
  const cutoff = new Date(Date.now() - (aggressive ? DEMO_JWT_TTL_MS : DEMO_TTL_MS));
  const expired = await client.user.findMany({
    where: { email: { endsWith: "@demo.friendchise.app" }, createdAt: { lt: cutoff } },
    select: { id: true },
  });
  if (expired.length === 0) return;
  const ids = expired.map((u) => u.id);
  await client.organization.deleteMany({ where: { ownerId: { in: ids } } });
  await client.user.deleteMany({ where: { id: { in: ids } } });
}

/** Returns a random pravatar URL — called once per person so images vary each demo run. */
export function randImg(): string {
  return `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70) + 1}`;
}
