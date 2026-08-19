import type { PrismaClient } from "@prisma/client";

export type SeedUserRecord = {
  id: string;
  email: string;
  name: string | null;
};

export type SeedPrismaLike = {
  user: Pick<PrismaClient["user"], "findUnique" | "update" | "delete">;
  organization: Pick<PrismaClient["organization"], "updateMany">;
  account: Pick<PrismaClient["account"], "updateMany">;
  session: Pick<PrismaClient["session"], "updateMany">;
  demoSession: Pick<PrismaClient["demoSession"], "updateMany">;
  invite: Pick<PrismaClient["invite"], "updateMany">;
  notification: Pick<PrismaClient["notification"], "updateMany">;
  announcementRead: Pick<PrismaClient["announcementRead"], "updateMany">;
  auditLog: Pick<PrismaClient["auditLog"], "updateMany">;
  feedback: Pick<PrismaClient["feedback"], "updateMany">;
  task: Pick<PrismaClient["task"], "updateMany">;
  taskComment: Pick<PrismaClient["taskComment"], "updateMany">;
  taskCommentVote: Pick<PrismaClient["taskCommentVote"], "updateMany">;
  scanTaskResult: Pick<PrismaClient["scanTaskResult"], "updateMany">;
  membership: Pick<PrismaClient["membership"], "findMany" | "findFirst" | "updateMany" | "delete">;
  memberRole: Pick<PrismaClient["memberRole"], "findMany" | "updateMany" | "deleteMany">;
  timetableEntryAssignee: Pick<PrismaClient["timetableEntryAssignee"], "findMany" | "updateMany" | "deleteMany">;
  timetableTemplateEntryAssignee: Pick<PrismaClient["timetableTemplateEntryAssignee"], "findMany" | "updateMany" | "deleteMany">;
  rosterEntry: Pick<PrismaClient["rosterEntry"], "findMany" | "updateMany" | "deleteMany">;
  rosterTemplateEntry: Pick<PrismaClient["rosterTemplateEntry"], "findMany" | "updateMany" | "deleteMany">;
};

type SeedTransactionalPrisma = SeedPrismaLike & {
  $transaction: PrismaClient["$transaction"];
};

async function migrateRelationRows<T extends { id: string }>(
  delegate: {
    findMany(args: { where: { membershipId: string } }): Promise<T[]>;
    updateMany(args: { where: { id: string }; data: { membershipId: string } }): Promise<unknown>;
    deleteMany(args: { where: { id: { in: string[] } } }): Promise<unknown>;
  },
  sourceMembershipId: string,
  targetMembershipId: string,
  naturalKey: (row: T) => string,
) {
  const [sourceRows, targetRows] = await Promise.all([
    delegate.findMany({ where: { membershipId: sourceMembershipId } }),
    delegate.findMany({ where: { membershipId: targetMembershipId } }),
  ]);

  const targetKeys = new Set(targetRows.map(naturalKey));
  const duplicateIds: string[] = [];

  for (const row of sourceRows) {
    if (targetKeys.has(naturalKey(row))) {
      duplicateIds.push(row.id);
      continue;
    }

    await delegate.updateMany({ where: { id: row.id }, data: { membershipId: targetMembershipId } });
  }

  if (duplicateIds.length > 0) {
    await delegate.deleteMany({ where: { id: { in: duplicateIds } } });
  }
}

async function migrateMembershipRows(prisma: SeedPrismaLike, sourceMembershipId: string, targetMembershipId: string) {
  await migrateRelationRows(prisma.memberRole, sourceMembershipId, targetMembershipId, (row) => row.roleId);
  await migrateRelationRows(prisma.timetableEntryAssignee, sourceMembershipId, targetMembershipId, (row) => row.timetableEntryId);
  await migrateRelationRows(prisma.timetableTemplateEntryAssignee, sourceMembershipId, targetMembershipId, (row) => row.templateEntryId);
  await migrateRelationRows(prisma.rosterEntry, sourceMembershipId, targetMembershipId, (row) => `${row.orgId}:${row.weekStart.toISOString()}:${row.dayIndex}`);
  await migrateRelationRows(prisma.rosterTemplateEntry, sourceMembershipId, targetMembershipId, (row) => `${row.templateId}:${row.weekIndex}:${row.dayIndex}`);
}

async function migrateDuplicateIvanUser(prisma: SeedPrismaLike, canonicalUserId: string, duplicateUserId: string) {
  await prisma.organization.updateMany({ where: { ownerId: duplicateUserId }, data: { ownerId: canonicalUserId } });

  const directUserIdUpdates = [
    () => prisma.account.updateMany({ where: { userId: duplicateUserId }, data: { userId: canonicalUserId } }),
    () => prisma.session.updateMany({ where: { userId: duplicateUserId }, data: { userId: canonicalUserId } }),
    () => prisma.demoSession.updateMany({ where: { userId: duplicateUserId }, data: { userId: canonicalUserId } }),
    () => prisma.notification.updateMany({ where: { userId: duplicateUserId }, data: { userId: canonicalUserId } }),
    () => prisma.announcementRead.updateMany({ where: { userId: duplicateUserId }, data: { userId: canonicalUserId } }),
    () => prisma.auditLog.updateMany({ where: { actorId: duplicateUserId }, data: { actorId: canonicalUserId } }),
    () => prisma.feedback.updateMany({ where: { userId: duplicateUserId }, data: { userId: canonicalUserId } }),
    () => prisma.task.updateMany({ where: { createdById: duplicateUserId }, data: { createdById: canonicalUserId } }),
    () => prisma.taskComment.updateMany({ where: { authorId: duplicateUserId }, data: { authorId: canonicalUserId } }),
    () => prisma.taskCommentVote.updateMany({ where: { userId: duplicateUserId }, data: { userId: canonicalUserId } }),
    () => prisma.scanTaskResult.updateMany({ where: { createdById: duplicateUserId }, data: { createdById: canonicalUserId } }),
  ] as const;

  await Promise.all(directUserIdUpdates.map((run) => run()));

  await prisma.invite.updateMany({ where: { invitedById: duplicateUserId }, data: { invitedById: canonicalUserId } });
  await prisma.invite.updateMany({ where: { recipientId: duplicateUserId }, data: { recipientId: canonicalUserId } });

  const duplicateMemberships = await prisma.membership.findMany({ where: { userId: duplicateUserId } });
  for (const duplicateMembership of duplicateMemberships) {
    const canonicalMembership = await prisma.membership.findFirst({
      where: { userId: canonicalUserId, orgId: duplicateMembership.orgId },
    });

    if (canonicalMembership) {
      await migrateMembershipRows(prisma, duplicateMembership.id, canonicalMembership.id);
      await prisma.membership.delete({ where: { id: duplicateMembership.id } });
      continue;
    }

    await prisma.membership.updateMany({
      where: { id: duplicateMembership.id },
      data: { userId: canonicalUserId },
    });
  }

  await prisma.user.delete({ where: { id: duplicateUserId } });
}

export async function reconcileIvanSeedIdentity(
  prisma: SeedPrismaLike,
  canonicalEmail: string,
  legacyEmail: string,
) {
  const [canonicalUser, legacyUser] = await Promise.all([
    prisma.user.findUnique({ where: { email: canonicalEmail } }),
    prisma.user.findUnique({ where: { email: legacyEmail } }),
  ]);

  if (!canonicalUser && !legacyUser) {
    return null;
  }

  if (!canonicalUser && legacyUser) {
    return prisma.user.update({
      where: { id: legacyUser.id },
      data: { email: canonicalEmail, name: "Ivan" },
    });
  }

  if (canonicalUser && !legacyUser) {
    return prisma.user.update({
      where: { id: canonicalUser.id },
      data: { email: canonicalEmail, name: "Ivan" },
    });
  }

  if (!canonicalUser || !legacyUser) {
    return null;
  }

  if (canonicalUser.id !== legacyUser.id) {
    await migrateDuplicateIvanUser(prisma, canonicalUser.id, legacyUser.id);
  }

  return prisma.user.update({
    where: { id: canonicalUser.id },
    data: { email: canonicalEmail, name: "Ivan" },
  });
}

export async function reconcileIvanSeedIdentityAtomic(
  prisma: SeedTransactionalPrisma,
  canonicalEmail: string,
  legacyEmail: string,
) {
  return prisma.$transaction((tx) => reconcileIvanSeedIdentity(tx, canonicalEmail, legacyEmail), {
    timeout: 120_000,
  });
}