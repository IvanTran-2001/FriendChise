import { ROLE_KEYS } from "@/lib/auth/rbac";
import { Prisma, PermissionAction, EntryStatus, TaskScope } from "@prisma/client";
import { seedEmail } from "@/lib/demo/seed-namespace";

import {
  commentVotes,
  comments,
  conversionItems,
  conversionRates,
  conversionTemplateEntries,
  conversionTemplates,
  DEMO_ENTRY_PLAN,
  FRANCHISE_TOKENS,
  FRANCHISEE_OPERATING_DAYS,
  franchiseePermissions,
  franchiseeRoles,
  GLOBAL_TASK_SCOPE_TASK_NAMES,
  DAY_INDEX_BY_KEY,
  ROSTER_MEMBERS,
  memberRoleAssignments,
  parentPermissions,
  parentRoles,
  ORGANIZATION_OPERATING_DAYS,
  MUST_MAKE_FIRST_STEPS,
  WORKING_DAYS_WEEKDAY,
  TASK_TAG_GROUPS,
  TASKS_SEED,
  TIMETABLE_TEMPLATE_ENTRIES,
  TIMETABLE_TEMPLATES,
  FRANCHISEE_TASKS_SEED,
} from "../data";
import { createSeedRows, makeDateUtils, randImg, timeToMin } from "./helpers";

export async function seedDemoOrg(ownerId: string, tx: Prisma.TransactionClient): Promise<string> {
  const { utcEntry } = makeDateUtils("Australia/Sydney");
  const now = new Date();
  type RoleRow = Awaited<ReturnType<typeof tx.role.createManyAndReturn>>[number];
  type MembershipRow = Awaited<ReturnType<typeof tx.membership.create>>;

  let org!: Awaited<ReturnType<typeof tx.organization.create>>;
  let roleRows: RoleRow[] = [];
  let roleByKey: Record<string, RoleRow> = {};
  let mOwner: MembershipRow;
  let otherMemberships: MembershipRow[] = [];
  let membershipByKey: Record<string, MembershipRow> = {};
  let mJordan: MembershipRow;
  let mCasey: MembershipRow;
  let mRiley: MembershipRow;
  let mAlex: MembershipRow;
  let mBotOpenSlot: MembershipRow;
  let mBotMorningRunner: MembershipRow;
  let mBotFryerBackup: MembershipRow;
  let mBotCounterFloat: MembershipRow;
  let mBotWeekendFill: MembershipRow;

  const bootstrapSteps: Record<(typeof MUST_MAKE_FIRST_STEPS)[number], () => Promise<void>> = {
    organization: async () => {
      org = await tx.organization.create({
        data: {
          name: "Donut Shop A",
          ownerId,
          openTimeMin: timeToMin("06:00"),
          closeTimeMin: timeToMin("18:00"),
          timezone: "Australia/Sydney",
          operatingDays: Array.from(ORGANIZATION_OPERATING_DAYS) as string[],
        },
      });
    },
    roles: async () => {
      roleRows = await tx.role.createManyAndReturn({
        data: parentRoles.map((role) => ({
          orgId: org!.id,
          key: role.key === "owner" ? ROLE_KEYS.OWNER : role.key === "default_member" ? ROLE_KEYS.DEFAULT_MEMBER : role.key,
          name: role.name,
          color: role.color,
          isDeletable: role.isDeletable,
          isDefault: role.isDefault,
        })),
      });
      roleByKey = Object.fromEntries(roleRows.map((row) => [row.key, row] as const)) as Record<string, RoleRow>;

      await tx.permission.createMany({
        data: parentPermissions.map((permission) => ({
          roleId: roleByKey[permission.roleKey]?.id ?? (() => {
            throw new Error(`Missing role for permission key: ${permission.roleKey}`);
          })(),
          action: permission.action as PermissionAction,
        })),
        skipDuplicates: true,
      });
    },
    memberships: async () => {
      mOwner = await tx.membership.create({
        data: { orgId: org!.id, userId: ownerId, workingDays: Array.from(WORKING_DAYS_WEEKDAY) as string[] },
      });

      otherMemberships = await Promise.all(
        ROSTER_MEMBERS.filter((member) => member.key !== "owner").map((member) =>
          tx.membership.create({
            data: {
              orgId: org!.id,
              userId: null,
              botName: member.botName,
              workingDays: member.days,
            },
          }),
        ),
      );

      membershipByKey = { owner: mOwner } as Record<string, MembershipRow>;
      ROSTER_MEMBERS.filter((member) => member.key !== "owner").forEach((member, index) => {
        membershipByKey[member.key] = otherMemberships[index]!;
      });

      const getMembership = (key: (typeof ROSTER_MEMBERS)[number]["key"]) => {
        const membership = membershipByKey[key];
        if (!membership) {
          throw new Error(`Missing membership for key: ${key}`);
        }
        return membership;
      };

      mJordan = getMembership("jordan");
      mCasey = getMembership("casey");
      mRiley = getMembership("riley");
      mAlex = getMembership("alex");
      mBotOpenSlot = getMembership("openSlot");
      mBotMorningRunner = getMembership("morningRunner");
      mBotFryerBackup = getMembership("fryerBackup");
      mBotCounterFloat = getMembership("counterFloat");
      mBotWeekendFill = getMembership("weekendFill");

      await tx.memberRole.createMany({
        data: memberRoleAssignments.map((assignment) => ({
          membershipId: {
            owner: mOwner,
            jordan: mJordan,
            casey: mCasey,
            riley: mRiley,
            alex: mAlex,
            openSlot: mBotOpenSlot,
            morningRunner: mBotMorningRunner,
            fryerBackup: mBotFryerBackup,
            counterFloat: mBotCounterFloat,
            weekendFill: mBotWeekendFill,
          }[assignment.membership]!.id,
          roleId: roleByKey[assignment.roleKey]!.id,
        })),
      });
    },
    roster: async () => {
      function getWeekStart(offsetWeeks: number): Date {
        const d = new Date(now);
        const dow = d.getUTCDay();
        d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow) + offsetWeeks * 7);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      }

      const rosterData = [] as Array<{
        orgId: string;
        membershipId: string;
        membershipOrgId: string;
        weekStart: Date;
        dayIndex: number;
        shiftStartMin: number;
        shiftEndMin: number;
      }>;

      for (const weekOffset of [-1, 0, 1, 2]) {
        const weekStart = getWeekStart(weekOffset);
        for (const member of ROSTER_MEMBERS) {
          for (const day of member.days) {
            rosterData.push({
              orgId: org!.id,
              membershipId: membershipByKey[member.key].id,
              membershipOrgId: org!.id,
              weekStart,
              dayIndex: DAY_INDEX_BY_KEY[day],
              shiftStartMin: member.start,
              shiftEndMin: member.end,
            });
          }
        }
      }
      await tx.rosterEntry.createMany({ data: rosterData, skipDuplicates: true });
    },
  };

  for (const step of MUST_MAKE_FIRST_STEPS) {
    await bootstrapSteps[step]();
  }

  if (!org) {
    throw new Error("Demo org bootstrap failed");
  }

  const taskRoleByKey: Record<string, string> = {
    counter_staff: roleByKey.counter_staff.id,
    fryer_op: roleByKey.fryer_op.id,
    shift_lead: roleByKey.shift_lead.id,
    trainee: roleByKey.trainee.id,
    default_member: roleByKey.default_member.id,
  };

  const [createdTasks, createdFranchiseeTasks] = await Promise.all([
    createSeedRows(tx, org!.id, TASKS_SEED),
    createSeedRows(tx, org!.id, FRANCHISEE_TASKS_SEED),
  ]);

  await Promise.all([
    tx.taskEligibility.createMany({
      data: TASKS_SEED.data.map(([name, , , , roleKey]) => ({ taskId: createdTasks.find((t) => t.name === name)!.id, roleId: taskRoleByKey[roleKey]! })),
    }),
    tx.taskInheritance.createMany({ data: createdTasks.map((task) => ({ taskId: task.id, orgId: org!.id })) }),
  ]);

  const tByName = Object.fromEntries(createdTasks.map((task) => [task.name, task]));
  const t = (name: string) => tByName[name]!;

  await tx.task.updateMany({
    where: {
      orgId: org!.id,
      name: {
        in: Array.from(GLOBAL_TASK_SCOPE_TASK_NAMES) as string[],
      },
    },
    data: { scope: TaskScope.GLOBAL },
  });

  const createdTemplates = await Promise.all(
    TIMETABLE_TEMPLATES.map((template) =>
      tx.timetableTemplate.create({ data: { orgId: org!.id, name: template.name, cycleLengthDays: template.cycleLengthDays } }),
    ),
  );
  const templateByName = Object.fromEntries(
    TIMETABLE_TEMPLATES.map((template, index) => [template.name, createdTemplates[index]!.id] as const),
  ) as Record<string, string>;

  await tx.timetableTemplateEntry.createMany({
    data: TIMETABLE_TEMPLATE_ENTRIES.map((entry) => ({
      templateId: templateByName[entry.templateName]!,
      taskId: t(entry.taskName).id,
      dayIndex: entry.dayIndex,
      startTimeMin: timeToMin(entry.startTime),
      endTimeMin: timeToMin(entry.endTime),
    })),
  });

  const entryData: Array<{
    orgId: string;
    taskId: string;
    taskName: string;
    taskDescription: string | null;
    durationMin: number;
    date: Date;
    startTimeMin: number;
    endTimeMin: number;
    status: EntryStatus;
  }> = [];
  const entryMembershipIds: string[] = [];

  for (const entry of DEMO_ENTRY_PLAN) {
    const task = t(entry.taskName);
    entryData.push({
      orgId: org!.id,
      taskId: task.id,
      taskName: task.name,
      taskDescription: task.description,
      durationMin: task.durationMin,
      ...utcEntry(entry.offsetDays, entry.hhmm, task.durationMin),
      status: entry.status as EntryStatus,
    });
    entryMembershipIds.push(membershipByKey[entry.membership].id);
  }

  const createdEntries = await tx.timetableEntry.createManyAndReturn({ data: entryData, select: { id: true } });
  await tx.timetableEntryAssignee.createMany({
    data: createdEntries.map(({ id }, i) => ({ timetableEntryId: id, membershipId: entryMembershipIds[i]! })),
  });

  await tx.franchiseToken.createMany({
    data: FRANCHISE_TOKENS.map((token) => ({
      orgId: org!.id,
      invitedEmail: token.invitedEmail,
      expiresAt: new Date(now.getTime() + token.expiresInDays * 24 * 60 * 60 * 1000),
    })),
  });

  const itemByName = Object.fromEntries(
    (await Promise.all(conversionItems.map((item) => tx.toolItem.create({ data: { orgId: org!.id, name: item.name, unit: item.unit } })))).map((item) => [item.name, item] as const),
  ) as Record<string, { id: string; name: string }>;

  const convSet = await tx.conversionSet.create({ data: { orgId: org.id, name: "Donut Production" } });

  await tx.conversionRate.createMany({
    data: conversionRates.map((rate) => ({
      setId: convSet.id,
      fromItemId: itemByName[rate.from]!.id,
      toItemId: itemByName[rate.to]!.id,
      fromQty: rate.fromQty,
      toQty: rate.toQty,
    })),
  });

  const createdConversionTemplates = await Promise.all(
    conversionTemplates.map((template) => tx.conversionTemplate.create({ data: { setId: convSet.id, name: template.name } })),
  );
  const conversionTemplateByName = Object.fromEntries(
    conversionTemplates.map((template, index) => [template.name, createdConversionTemplates[index]!.id] as const),
  ) as Record<string, string>;

  await tx.conversionTemplateEntry.createMany({
    data: conversionTemplateEntries.map((entry) => ({
      templateId: conversionTemplateByName[entry.template]!,
      itemId: itemByName[entry.item]!.id,
      quantity: entry.quantity,
      pinnedOutput: entry.pinnedOutput,
    })),
  });

  const tagByName = Object.fromEntries(
    (await Promise.all(
      TASK_TAG_GROUPS.map((group) => tx.tag.create({ data: { orgId: org!.id, name: group.name, color: group.color } })),
    )).map((row) => [row.name, row] as const),
  ) as Record<string, { id: string; name: string }>;

  await tx.taskTag.createMany({
    data: TASK_TAG_GROUPS.flatMap((group) => group.taskNames.map((taskName) => ({ taskId: t(taskName).id, tagId: tagByName[group.name]!.id }))),
  });

  const commentImages = Object.fromEntries(comments.map((comment) => [comment.author, randImg()] as const)) as Record<string, string>;
  const createdComments: Array<{ id: string }> = [];
  for (const [index, comment] of comments.entries()) {
    const created = await tx.taskComment.create({
      data: {
        taskId: t(comment.taskName).id,
        orgId: org!.id,
        authorId: comment.author === "Demo User" ? ownerId : null,
        authorName: comment.author,
        authorImage: commentImages[comment.author],
        content: comment.content,
        parentId: comment.parentIndex === undefined ? undefined : createdComments[comment.parentIndex]!.id,
        isPinned: comment.pinned ?? false,
        pinnedAt: comment.pinned ? new Date(now.getTime() + ((comment.pinnedOffsetDays ?? 0) * 24 * 60 * 60 * 1000)) : undefined,
        createdAt: new Date(now.getTime() + comment.createdOffsetHours * 60 * 60 * 1000),
      },
    });
    createdComments[index] = created;
  }

  const seededVoteUserIds = new Map<string, string>([
    ["owner", ownerId],
  ]);
  // Only resolve the vote-user keys that commentVotes actually references —
  // avoids failing demo provisioning over unrelated fixture accounts that
  // aren't referenced by any vote (those depend on the shared dev/CI seed
  // namespace and are not guaranteed to exist in every environment).
  const voteUserKeys = Array.from(new Set(commentVotes.map((vote) => vote.user))).filter((key) => key !== "owner");
  await Promise.all(
    voteUserKeys.map(async (key) => {
      const user = await tx.user.findUnique({
        where: { email: seedEmail(key) },
        select: { id: true },
      });
      if (!user) {
        throw new Error(`Missing seeded vote user: ${key}`);
      }
      seededVoteUserIds.set(key, user.id);
    }),
  );

  await tx.taskCommentVote.createMany({
    data: commentVotes.map((vote) => ({
      commentId: createdComments[vote.commentIndex]!.id,
      userId: seededVoteUserIds.get(vote.user)!,
      type: vote.type,
    })),
  });

  const franchisee = await tx.organization.create({ data: { name: "Downtown Donuts", ownerId, parentId: org!.id, openTimeMin: timeToMin("07:00"), closeTimeMin: timeToMin("17:00"), timezone: "Australia/Sydney", operatingDays: Array.from(FRANCHISEE_OPERATING_DAYS) as string[] } });
  const franchiseeRoleRows = await tx.role.createManyAndReturn({
    data: franchiseeRoles.map((role) => ({
      orgId: franchisee.id,
      key: role.key === "owner" ? ROLE_KEYS.OWNER : ROLE_KEYS.DEFAULT_MEMBER,
      name: role.name,
      color: role.color,
      isDeletable: role.isDeletable,
      isDefault: role.isDefault,
    })),
  });
  const fRoleOwner = franchiseeRoleRows.find((role) => role.key === ROLE_KEYS.OWNER)!;
  const fRoleWorker = franchiseeRoleRows.find((role) => role.key === ROLE_KEYS.DEFAULT_MEMBER)!;
  await tx.permission.createMany({
    data: franchiseePermissions.map((permission) => ({ roleId: fRoleOwner.id, action: permission.action as PermissionAction })),
    skipDuplicates: true,
  });
  const fOwner = await tx.membership.create({ data: { orgId: franchisee.id, userId: ownerId, workingDays: Array.from(WORKING_DAYS_WEEKDAY) as string[] } });
  await tx.memberRole.create({ data: { membershipId: fOwner.id, roleId: fRoleOwner.id } });

  await Promise.all([
    tx.taskEligibility.createMany({ data: createdFranchiseeTasks.map((task) => ({ taskId: task.id, roleId: fRoleWorker.id })) }),
    tx.taskInheritance.createMany({ data: createdFranchiseeTasks.map((task) => ({ taskId: task.id, orgId: franchisee.id })) }),
  ]);

  return org!.id;
}
