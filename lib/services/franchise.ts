/**
 * Franchise clone helpers.
 *
 * These functions are called inside a Prisma transaction when a franchisee
 * joins a parent org. Each helper copies one aspect of the parent's structure
 * into the child org — with no users, assignees, or live operational data
 * carried over.
 *
 * Add new clone functions here as the franchise onboarding flow grows
 * (e.g. cloneTasksFromParent, cloneTimetableSettingsFromParent, etc.).
 */

import { prisma } from "@/lib/prisma";
import { ROLE_KEYS } from "@/lib/rbac";

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Clones all roles and their permissions from a parent org into a child org.
 *
 * What is cloned:
 *   - Every Role (name, key, color, isDeletable, isDefault)
 *   - Every Permission attached to each role (the PermissionAction values)
 *
 * What is NOT cloned:
 *   - Members / MemberRole assignments — the child starts with zero users.
 *     The joining user is separately assigned as Owner after this runs.
 *
 * After cloning, the calling user is added as a membership and assigned the
 * cloned Owner role so they can administer their own branch.
 */
export async function cloneRolesFromParent(
  tx: Tx,
  parentOrgId: string,
  childOrgId: string,
  userId: string,
) {
  // Fetch all roles + their permission actions from the parent
  const parentRoles = await tx.role.findMany({
    where: { orgId: parentOrgId },
    include: { permissions: { select: { action: true } } },
  });

  // Clone each role (fresh IDs, same structure + permissions, no members)
  const clonedRoles = await Promise.all(
    parentRoles.map((role) =>
      tx.role.create({
        data: {
          orgId: childOrgId,
          name: role.name,
          key: role.key,
          color: role.color,
          isDeletable: role.isDeletable,
          isDefault: role.isDefault,
          permissions: {
            create: role.permissions.map(({ action }) => ({ action })),
          },
        },
      }),
    ),
  );

  // Build a map of parent role ID → cloned role ID (Promise.all preserves order)
  const roleIdMap = new Map<string, string>(
    parentRoles.map((r, i) => [r.id, clonedRoles[i].id]),
  );

  // Assign the joining user as Owner of the new child org
  const ownerRole = clonedRoles.find((r) => r.key === ROLE_KEYS.OWNER);
  if (!ownerRole) throw new Error("Parent org has no Owner role to clone");

  const membership = await tx.membership.create({
    data: { orgId: childOrgId, userId, workingDays: [] },
  });

  await tx.memberRole.create({
    data: { membershipId: membership.id, roleId: ownerRole.id },
  });

  return { clonedRoles, roleIdMap, membership };
}

/**
 * Clones all tasks and their role eligibility from a parent org into a child org.
 *
 * What is cloned:
 *   - Every Task (name, description, color, durations, constraints)
 *   - TaskEligibility records — role IDs are remapped via roleIdMap so
 *     eligibility points at the cloned roles, not the parent's.
 *
 * Returns a taskIdMap (parent task ID → child task ID) for use by
 * cloneTemplatesFromParent.
 */
export async function cloneTasksFromParent(
  tx: Tx,
  parentOrgId: string,
  childOrgId: string,
  roleIdMap: Map<string, string>,
) {
  const parentTasks = await tx.task.findMany({
    where: { orgId: parentOrgId },
    include: { eligibility: { select: { roleId: true } } },
  });

  const taskIdMap = new Map<string, string>();

  await Promise.all(
    parentTasks.map(async (task) => {
      const cloned = await tx.task.create({
        data: {
          orgId: childOrgId,
          name: task.name,
          description: task.description,
          color: task.color,
          durationMin: task.durationMin,
          minPeople: task.minPeople,
          maxPeople: task.maxPeople,
          priority: task.priority,
          preferredStartTimeMin: task.preferredStartTimeMin,
          minWaitDays: task.minWaitDays,
          maxWaitDays: task.maxWaitDays,
          eligibility: {
            create: task.eligibility
              .map(({ roleId }) => roleIdMap.get(roleId))
              .filter((id): id is string => id !== undefined)
              .map((roleId) => ({ roleId })),
          },
        },
      });
      taskIdMap.set(task.id, cloned.id);
    }),
  );

  return { taskIdMap };
}

/**
 *
 * What is cloned:
 *   - Every Template (name, cycleLengthDays)
 *   - Every TemplateEntry per template — taskIds are remapped via taskIdMap
 *     so entries point at the cloned tasks, not the parent's.
 *
 * What is NOT cloned:
 *   - TemplateEntryAssignee records — no role/member assignments are carried
 *     over. The child org's staff will be assigned separately.
 *
 * Entries whose parent taskId has no mapping in taskIdMap are skipped to
 * avoid foreign-key violations.
 */
export async function cloneTemplatesFromParent(
  tx: Tx,
  parentOrgId: string,
  childOrgId: string,
  taskIdMap: Map<string, string>,
) {
  const parentTemplates = await tx.template.findMany({
    where: { orgId: parentOrgId },
    include: {
      entries: {
        select: {
          taskId: true,
          dayIndex: true,
          startTimeMin: true,
          endTimeMin: true,
          priority: true,
          durationMin: true,
        },
      },
    },
  });

  const clonedTemplates = await Promise.all(
    parentTemplates.map((template) =>
      tx.template.create({
        data: {
          orgId: childOrgId,
          name: template.name,
          cycleLengthDays: template.cycleLengthDays,
          entries: {
            create: template.entries
              .filter((entry) => taskIdMap.has(entry.taskId))
              .map((entry) => ({
                taskId: taskIdMap.get(entry.taskId)!,
                dayIndex: entry.dayIndex,
                startTimeMin: entry.startTimeMin,
                endTimeMin: entry.endTimeMin,
                priority: entry.priority,
                durationMin: entry.durationMin,
              })),
          },
        },
      }),
    ),
  );

  return { clonedTemplates };
}

/**
 * Clones timetable view settings from a parent org into a child org.
 * If the parent has no settings record, this is a no-op.
 */
export async function cloneTimetableSettingsFromParent(
  tx: Tx,
  parentOrgId: string,
  childOrgId: string,
) {
  const settings = await tx.timetableSettings.findUnique({
    where: { orgId: parentOrgId },
  });
  if (!settings) return null;
  return tx.timetableSettings.create({
    data: {
      orgId: childOrgId,
      viewType: settings.viewType,
      startDay: settings.startDay,
      slotDuration: settings.slotDuration,
    },
  });
}
