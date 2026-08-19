export type SeedUserRecord = {
  id: string;
  email: string;
  name: string | null;
};

type ReassignableModel = {
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
};

export type SeedPrismaLike = {
  user: {
    findUnique(args: { where: { email: string } }): Promise<SeedUserRecord | null>;
    update(args: { where: { id: string }; data: { email?: string; name?: string } }): Promise<SeedUserRecord>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
  organization: ReassignableModel;
  account: ReassignableModel;
  session: ReassignableModel;
  demoSession: ReassignableModel;
  invite: ReassignableModel;
  notification: ReassignableModel;
  announcementRead: ReassignableModel;
  auditLog: ReassignableModel;
  feedback: ReassignableModel;
  task: ReassignableModel;
  taskComment: ReassignableModel;
  taskCommentVote: ReassignableModel;
  scanTaskResult: {
    updateMany(args: { where: Record<string, unknown>; data: { createdById?: string } }): Promise<unknown>;
  };
  membership: {
    findMany(args: { where: { userId: string } }): Promise<Array<{ id: string; orgId: string }>>;
    findFirst(args: { where: { userId: string; orgId: string } }): Promise<{ id: string; orgId: string } | null>;
    updateMany(args: { where: { id: string }; data: { userId?: string } }): Promise<unknown>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
  memberRole: {
    findMany(args: { where: { membershipId: string } }): Promise<Array<{ id: string; membershipId: string; roleId: string }>>;
    updateMany(args: { where: { id: string }; data: { membershipId?: string } }): Promise<unknown>;
    deleteMany(args: { where: { id: { in: string[] } } }): Promise<unknown>;
  };
  timetableEntryAssignee: {
    findMany(args: { where: { membershipId: string } }): Promise<Array<{ id: string; membershipId: string; timetableEntryId: string }>>;
    updateMany(args: { where: { id: string }; data: { membershipId?: string } }): Promise<unknown>;
    deleteMany(args: { where: { id: { in: string[] } } }): Promise<unknown>;
  };
  timetableTemplateEntryAssignee: {
    findMany(args: { where: { membershipId: string } }): Promise<Array<{ id: string; membershipId: string; templateEntryId: string }>>;
    updateMany(args: { where: { id: string }; data: { membershipId?: string } }): Promise<unknown>;
    deleteMany(args: { where: { id: { in: string[] } } }): Promise<unknown>;
  };
  rosterEntry: {
    findMany(args: { where: { membershipId: string } }): Promise<Array<{ id: string; membershipId: string; orgId: string; weekStart: Date; dayIndex: number }>>;
    updateMany(args: { where: { id: string }; data: { membershipId?: string } }): Promise<unknown>;
    deleteMany(args: { where: { id: { in: string[] } } }): Promise<unknown>;
  };
  rosterTemplateEntry: {
    findMany(args: { where: { membershipId: string } }): Promise<Array<{ id: string; membershipId: string; templateId: string; weekIndex: number; dayIndex: number }>>;
    updateMany(args: { where: { id: string }; data: { membershipId?: string } }): Promise<unknown>;
    deleteMany(args: { where: { id: { in: string[] } } }): Promise<unknown>;
  };
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