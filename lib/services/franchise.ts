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

  // Assign the joining user as Owner of the new child org
  const ownerRole = clonedRoles.find((r) => r.key === ROLE_KEYS.OWNER);
  if (!ownerRole) throw new Error("Parent org has no Owner role to clone");

  const membership = await tx.membership.create({
    data: { orgId: childOrgId, userId, workingDays: [] },
  });

  await tx.memberRole.create({
    data: { membershipId: membership.id, roleId: ownerRole.id },
  });

  return { clonedRoles, membership };
}

/**
 * Clones all timetable templates and their entries from a parent org into a
 * child org.
 *
 * What is cloned:
 *   - Every Template (name, cycleLengthDays)
 *   - Every TemplateEntry per template (dayIndex, startTimeMin, endTimeMin,
 *     priority, durationMin) — the taskId is preserved so the entry still
 *     references the same task definition.
 *
 * What is NOT cloned:
 *   - TemplateEntryAssignee records — no role/member assignments are carried
 *     over. The child org's staff will be assigned separately.
 *   - Tasks themselves — tasks belong to an org and are not cloned here.
 *     If you also want to clone tasks, call cloneTasksFromParent first and
 *     remap taskIds before calling this function.
 *
 * Note: if the parent has template entries that reference tasks not present in
 * the child org, those entries will fail to create (foreign key violation).
 * Clone tasks first if needed.
 */
export async function cloneTemplatesFromParent(
  tx: Tx,
  parentOrgId: string,
  childOrgId: string,
) {
  // Fetch all templates + their entries (no assignees)
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

  // Clone each template with its entries (no assignees)
  const clonedTemplates = await Promise.all(
    parentTemplates.map((template) =>
      tx.template.create({
        data: {
          orgId: childOrgId,
          name: template.name,
          cycleLengthDays: template.cycleLengthDays,
          entries: {
            create: template.entries.map((entry) => ({
              taskId: entry.taskId,
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
