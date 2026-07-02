import { Prisma, PrismaClient } from "@prisma/client";
import type { Users } from "./users";

type Actor = {
  userId: string;
  email: string;
  name: string;
};

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)] ?? values[0]!;
}

function minutesAgo(rng: () => number, maxDays: number): Date {
  const minutes = Math.floor(rng() * maxDays * 24 * 60);
  return new Date(Date.now() - minutes * 60_000);
}

export async function seedRandomAuditLogs(
  prisma: PrismaClient,
  orgId: string,
  users: Users,
) {
  const [memberships, roles] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId },
      select: { id: true, userId: true },
    }),
    prisma.role.findMany({
      where: { orgId },
      select: { id: true, key: true, name: true },
    }),
  ]);

  const membershipByUserId = new Map(
    memberships.map((membership) => [membership.userId, membership.id]),
  );
  const roleByKey = new Map(roles.map((role) => [role.key, role.id]));

  const actors: Actor[] = [
    { userId: users.owner.id, email: users.owner.email, name: users.owner.name ?? "MainDev" },
    { userId: users.jordan.id, email: users.jordan.email, name: users.jordan.name ?? "Jordan" },
    { userId: users.casey.id, email: users.casey.email, name: users.casey.name ?? "Casey" },
    { userId: users.riley.id, email: users.riley.email, name: users.riley.name ?? "Riley" },
    { userId: users.alex.id, email: users.alex.email, name: users.alex.name ?? "Alex" },
  ];

  const rng = createRng(`${orgId}:${users.owner.id}`);
  const now = new Date();

  const orgActions = [
    () => ({
      action: "organization.update",
      targetType: "Organization",
      targetId: orgId,
      before: {
        address: "42 Harbour Street, Sydney NSW 2000",
        timezone: "Australia/Sydney",
      },
      after: {
        address: "42 Harbour Street, Sydney NSW 2000",
        timezone: "Australia/Sydney",
        openTimeMin: 360,
        closeTimeMin: 1080,
      },
      metadata: { source: "seed", field: "hours" },
    }),
    () => ({
      action: "membership.create",
      targetType: "Membership",
      targetId: membershipByUserId.get(users.alex.id) ?? users.alex.id,
      before: null,
      after: {
        userId: users.alex.id,
        workingDays: ["tue", "thu", "sat", "sun"],
      },
      metadata: { source: "seed", shift: "afternoon" },
    }),
    () => ({
      action: "role.update",
      targetType: "Role",
      targetId: roleByKey.get("shift_lead") ?? roles[0]?.id ?? orgId,
      before: { color: "#8B5CF6" },
      after: { color: "#7C3AED", label: "Shift Lead" },
      metadata: { source: "seed", note: "Refreshed role palette" },
    }),
    () => ({
      action: "task.create",
      targetType: "Task",
      targetId: `seed-task-${Math.floor(rng() * 10_000)}`,
      before: null,
      after: {
        name: "Morning Prep Sweep",
        status: "todo",
        durationMin: 20,
      },
      metadata: { source: "seed", priority: "medium" },
    }),
    () => ({
      action: "timetable.create",
      targetType: "TimetableEntry",
      targetId: `seed-entry-${Math.floor(rng() * 10_000)}`,
      before: null,
      after: {
        date: now.toISOString().slice(0, 10),
        startTimeMin: 480,
        endTimeMin: 540,
        status: "planned",
      },
      metadata: { source: "seed", note: "Auto-generated roster check" },
    }),
    () => ({
      action: "invite.send",
      targetType: "Invite",
      targetId: `seed-invite-${Math.floor(rng() * 10_000)}`,
      before: null,
      after: {
        email: users.morgan.email,
        role: "Default Member",
      },
      metadata: { source: "seed", channel: "email" },
    }),
  ] as const;

  const logs: Prisma.AuditLogCreateManyInput[] = Array.from({ length: 24 }, (_, index) => {
    const actor = pick(rng, actors);
    const entry = pick(rng, orgActions)();
    const createdAt = new Date(minutesAgo(rng, 14).getTime() - index * 5 * 60_000);

    return {
      orgId,
      actorId: actor.userId,
      actorEmail: actor.email,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      before: entry.before ?? Prisma.JsonNull,
      after: entry.after ?? Prisma.JsonNull,
      metadata: {
        ...entry.metadata,
        actorName: actor.name,
      },
      createdAt,
    };
  });

  console.log(`→ Creating ${logs.length} random audit logs...`);
  await prisma.auditLog.createMany({ data: logs });
  console.log(`  ✓ ${logs.length} audit logs created`);
}