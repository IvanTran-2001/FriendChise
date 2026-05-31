/**
 * Shared helpers for integration tests.
 *
 * All tests hit the real dev database (seeded fresh before each run).
 * Tests that create memberships for non-seed users use createTempUser() +
 * cleanupTempUser() so the seeded non-member pool is never permanently depleted.
 */
import { prisma } from "@/lib/prisma";
import { ROLE_KEYS } from "@/lib/rbac";

export const SEED_USER_EMAIL =
  process.env.INTEGRATION_TEST_USER_EMAIL ?? "casey@example.test";

/** Returns the integration-test seed user (Casey). */
export async function getSeedUser() {
  return prisma.user.findFirstOrThrow({ where: { email: SEED_USER_EMAIL } });
}

/** Returns the first org the seed user belongs to (Donut Shop A). */
export async function getSeedOrg() {
  const user = await getSeedUser();
  const membership = await prisma.membership.findFirstOrThrow({
    where: { userId: user.id },
    include: { organization: true },
  });
  return membership.organization;
}

/** Returns any user who is NOT currently a member of the given org. */
export async function getNonMember(orgId: string) {
  const existing = await prisma.membership.findMany({
    where: { orgId },
    select: { userId: true },
  });
  const memberIds = existing.map((m) => m.userId).filter(Boolean) as string[];
  return prisma.user.findFirstOrThrow({ where: { id: { notIn: memberIds } } });
}

/** Returns the DefaultMember role for an org. */
export async function getDefaultRole(orgId: string) {
  return prisma.role.findFirstOrThrow({
    where: { orgId, key: ROLE_KEYS.DEFAULT_MEMBER },
  });
}

/** Creates a task with a unique name in the given org. */
export async function createSeedTask(orgId: string) {
  return prisma.task.create({
    data: {
      orgId,
      name: `Task ${crypto.randomUUID()}`,
      color: "#4444ff",
      durationMin: 30,
    },
  });
}

/**
 * Creates a timetable entry directly via Prisma (bypasses service UTC conversion).
 * Suitable for test setup when you just need an entry row to operate on.
 */
export async function createSeedEntry(orgId: string) {
  const task = await prisma.task.findFirstOrThrow({ where: { orgId } });
  return prisma.timetableEntry.create({
    data: {
      orgId,
      taskId: task.id,
      taskName: task.name,
      taskColor: task.color,
      taskDescription: task.description,
      durationMin: task.durationMin,
      date: new Date("2026-07-01"),
      startTimeMin: 360,
      endTimeMin: 390,
    },
  });
}

/**
 * Creates a throw-away user with a random test email.
 * Always pair with cleanupTempUser() in a finally block.
 */
export async function createTempUser() {
  return prisma.user.create({
    data: {
      email: `tmp-${crypto.randomUUID()}@test.invalid`,
      name: "Temp Integration User",
    },
  });
}

/**
 * Deletes a temp user and all their associated records in dependency order.
 * Safe to call even if the user has no memberships/invites.
 */
export async function cleanupTempUser(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { id: true },
  });
  const membershipIds = memberships.map((m) => m.id);

  if (membershipIds.length > 0) {
    await prisma.timetableEntryAssignee.deleteMany({
      where: { membershipId: { in: membershipIds } },
    });
    await prisma.timetableTemplateEntryAssignee.deleteMany({
      where: { membershipId: { in: membershipIds } },
    });
    await prisma.memberRole.deleteMany({
      where: { membershipId: { in: membershipIds } },
    });
    await prisma.membership.deleteMany({
      where: { id: { in: membershipIds } },
    });
  }

  await prisma.invite.deleteMany({ where: { recipientId: userId } });
  await prisma.user.delete({ where: { id: userId } });
}

/**
 * Creates a minimal throw-away org (owned by the seed user) plus one task in
 * it. Use this to get a cross-org task for scoping tests.
 * Always pair with cleanupTempOrg(org.id) in a finally block.
 */
export async function createTempOrgWithTask() {
  const owner = await getSeedUser();
  const org = await prisma.organization.create({
    data: {
      name: `Tmp Org ${crypto.randomUUID()}`,
      ownerId: owner.id,
      timezone: "UTC",
    },
  });
  const task = await prisma.task.create({
    data: {
      orgId: org.id,
      name: `Tmp Task ${crypto.randomUUID()}`,
      color: "#888888",
      durationMin: 30,
    },
  });
  return { org, task };
}

/**
 * Deletes a temporary org and all its cascade-deleted records.
 * Cascades to roles, memberships, tasks, etc. per schema ON DELETE CASCADE.
 */
export async function cleanupTempOrg(orgId: string) {
  await prisma.organization.delete({ where: { id: orgId } });
}
