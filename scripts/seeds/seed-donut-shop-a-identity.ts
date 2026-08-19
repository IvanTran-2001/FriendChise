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

const DIRECT_USER_ID_MODELS = [
  ["account", "userId"],
  ["session", "userId"],
  ["demoSession", "userId"],
  ["notification", "userId"],
  ["announcementRead", "userId"],
  ["auditLog", "actorId"],
  ["feedback", "userId"],
  ["task", "createdById"],
  ["taskComment", "authorId"],
  ["taskCommentVote", "userId"],
  ["scanTaskResult", "createdById"],
] as const;

async function migrateMembershipRows(prisma: SeedPrismaLike, sourceMembershipId: string, targetMembershipId: string) {
  const [memberRoles, entryAssignees, templateAssignees, rosterEntries, rosterTemplateEntries] = await Promise.all([
    prisma.memberRole.findMany({ where: { membershipId: sourceMembershipId } }),
    prisma.timetableEntryAssignee.findMany({ where: { membershipId: sourceMembershipId } }),
    prisma.timetableTemplateEntryAssignee.findMany({ where: { membershipId: sourceMembershipId } }),
    prisma.rosterEntry.findMany({ where: { membershipId: sourceMembershipId } }),
    prisma.rosterTemplateEntry.findMany({ where: { membershipId: sourceMembershipId } }),
  ]);

  const canonicalMemberRoleIds = new Set(
    (await prisma.memberRole.findMany({ where: { membershipId: targetMembershipId } })).map((row) => row.roleId),
  );
  const duplicateMemberRoleIds: string[] = [];
  for (const row of memberRoles) {
    if (canonicalMemberRoleIds.has(row.roleId)) {
      duplicateMemberRoleIds.push(row.id);
      continue;
    }
    await prisma.memberRole.updateMany({ where: { id: row.id }, data: { membershipId: targetMembershipId } });
  }
  if (duplicateMemberRoleIds.length > 0) {
    await prisma.memberRole.deleteMany({ where: { id: { in: duplicateMemberRoleIds } } });
  }

  const canonicalEntryIds = new Set(
    (await prisma.timetableEntryAssignee.findMany({ where: { membershipId: targetMembershipId } })).map((row) => row.timetableEntryId),
  );
  const duplicateEntryIds: string[] = [];
  for (const row of entryAssignees) {
    if (canonicalEntryIds.has(row.timetableEntryId)) {
      duplicateEntryIds.push(row.id);
      continue;
    }
    await prisma.timetableEntryAssignee.updateMany({ where: { id: row.id }, data: { membershipId: targetMembershipId } });
  }
  if (duplicateEntryIds.length > 0) {
    await prisma.timetableEntryAssignee.deleteMany({ where: { id: { in: duplicateEntryIds } } });
  }

  const canonicalTemplateEntryIds = new Set(
    (await prisma.timetableTemplateEntryAssignee.findMany({ where: { membershipId: targetMembershipId } })).map((row) => row.templateEntryId),
  );
  const duplicateTemplateEntryIds: string[] = [];
  for (const row of templateAssignees) {
    if (canonicalTemplateEntryIds.has(row.templateEntryId)) {
      duplicateTemplateEntryIds.push(row.id);
      continue;
    }
    await prisma.timetableTemplateEntryAssignee.updateMany({ where: { id: row.id }, data: { membershipId: targetMembershipId } });
  }
  if (duplicateTemplateEntryIds.length > 0) {
    await prisma.timetableTemplateEntryAssignee.deleteMany({ where: { id: { in: duplicateTemplateEntryIds } } });
  }

  const canonicalRosterEntries = new Set(
    (await prisma.rosterEntry.findMany({ where: { membershipId: targetMembershipId } })).map(
      (row) => `${row.orgId}:${row.weekStart.toISOString()}:${row.dayIndex}`,
    ),
  );
  const duplicateRosterEntryIds: string[] = [];
  for (const row of rosterEntries) {
    const key = `${row.orgId}:${row.weekStart.toISOString()}:${row.dayIndex}`;
    if (canonicalRosterEntries.has(key)) {
      duplicateRosterEntryIds.push(row.id);
      continue;
    }
    await prisma.rosterEntry.updateMany({ where: { id: row.id }, data: { membershipId: targetMembershipId } });
  }
  if (duplicateRosterEntryIds.length > 0) {
    await prisma.rosterEntry.deleteMany({ where: { id: { in: duplicateRosterEntryIds } } });
  }

  const canonicalRosterTemplateEntries = new Set(
    (await prisma.rosterTemplateEntry.findMany({ where: { membershipId: targetMembershipId } })).map(
      (row) => `${row.templateId}:${row.weekIndex}:${row.dayIndex}`,
    ),
  );
  const duplicateRosterTemplateEntryIds: string[] = [];
  for (const row of rosterTemplateEntries) {
    const key = `${row.templateId}:${row.weekIndex}:${row.dayIndex}`;
    if (canonicalRosterTemplateEntries.has(key)) {
      duplicateRosterTemplateEntryIds.push(row.id);
      continue;
    }
    await prisma.rosterTemplateEntry.updateMany({ where: { id: row.id }, data: { membershipId: targetMembershipId } });
  }
  if (duplicateRosterTemplateEntryIds.length > 0) {
    await prisma.rosterTemplateEntry.deleteMany({ where: { id: { in: duplicateRosterTemplateEntryIds } } });
  }
}

async function migrateDuplicateIvanUser(prisma: SeedPrismaLike, canonicalUserId: string, duplicateUserId: string) {
  await prisma.organization.updateMany({ where: { ownerId: duplicateUserId }, data: { ownerId: canonicalUserId } });

  await Promise.all(
    DIRECT_USER_ID_MODELS.map(([modelName, fieldName]) =>
      prisma[modelName].updateMany({ where: { [fieldName]: duplicateUserId }, data: { [fieldName]: canonicalUserId } }),
    ),
  );

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
    return canonicalUser;
  }

  if (!canonicalUser || !legacyUser) {
    return canonicalUser ?? legacyUser;
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
  return prisma.$transaction((tx) => reconcileIvanSeedIdentity(tx, canonicalEmail, legacyEmail));
}