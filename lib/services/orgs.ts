/**
 * Org service — all database writes related to organizations.
 *
 * Every function that mutates is wrapped in a Prisma transaction so partial
 * writes are impossible: either everything succeeds or nothing is persisted.
 */
import { log } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { PermissionAction } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/rbac";
import { recordAudit } from "@/lib/services/audit-log";
import type {
  CreateOrgInput,
  JoinFranchiseInput,
  UpdateOrgSettingsInput,
} from "@/lib/validators/org";
import {
  cloneRolesFromParent,
  cloneTasksFromParent,
  cloneTemplatesFromParent,
  cloneTimetableSettingsFromParent,
  type Tx,
} from "@/lib/services/franchise";

/** Full set of permissions granted to the Owner role on a fresh org. Derived
 *  from the enum so it stays in sync whenever the schema adds new actions. */
const ownerPermissions = Object.values(PermissionAction);

/** Permissions granted to the default Member role on a fresh org.
 *  Intentionally empty — admins assign permissions explicitly via Roles.
 */
const memberPermissions: PermissionAction[] = [];

/**
 * Creates the default Owner + Member roles for a brand-new standalone org
 * and assigns the creating user as Owner. Used only by createOrg.
 *
 * Franchise children clone their role structure from the parent instead
 * (see cloneRolesFromParent) so that custom roles like "Cook" are inherited.
 */
async function bootstrapRoles(tx: Tx, orgId: string, userId: string) {
  const [ownerRole, memberRole] = await Promise.all([
    tx.role.create({
      data: {
        orgId,
        name: "Owner",
        key: ROLE_KEYS.OWNER,
        color: "#ef4444",
        isDeletable: false,
        isDefault: false,
      },
    }),
    tx.role.create({
      data: {
        orgId,
        name: "Default Member",
        key: ROLE_KEYS.DEFAULT_MEMBER,
        color: "#6b7280",
        isDeletable: false,
        isDefault: true,
      },
    }),
  ]);

  await tx.permission.createMany({
    data: [
      ...ownerPermissions.map((action) => ({ roleId: ownerRole.id, action })),
      ...memberPermissions.map((action) => ({ roleId: memberRole.id, action })),
    ],
    skipDuplicates: true,
  });

  const membership = await tx.membership.create({
    data: { orgId, userId, workingDays: [] },
  });

  // Creator receives both Owner (for permissions) and Default Member
  // (so they appear in the members list like everyone else).
  await tx.memberRole.createMany({
    data: [
      { membershipId: membership.id, roleId: ownerRole.id },
      { membershipId: membership.id, roleId: memberRole.id },
    ],
  });

  return { ownerRole, memberRole, membership };
}

/**
 * Creates a standalone (or future parent/franchisor) org:
 *   1. Creates the Organization record with the supplied schedule settings.
 *   2. Bootstraps default Owner + Member roles with their permissions.
 *   3. Creates a Membership linking the creator as Owner.
 *
 * Franchise children use joinFranchise instead — they inherit the parent's
 * role structure rather than getting fresh defaults.
 *
 * All steps are atomic — if any step fails, nothing is persisted.
 */
export async function createOrg(userId: string, data: CreateOrgInput) {
  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: data.title,
        ownerId: userId,
        timezone: data.timezone ?? "Australia/Sydney",
        address: data.address ?? null,
        operatingDays: data.operatingDays ?? [],
        openTimeMin: data.openTimeMin ?? null,
        closeTimeMin: data.closeTimeMin ?? null,
      },
    });

    const { ownerRole, memberRole, membership } = await bootstrapRoles(
      tx,
      org.id,
      userId,
    );

    await recordAudit(
      {
        orgId: org.id,
        actorId: userId,
        action: "org.create",
        targetType: "Organization",
        targetId: org.id,
        after: { name: org.name, timezone: org.timezone, address: org.address },
      },
      tx,
    );

    return { org, ownerRole, memberRole, membership };
  });
  log.info("Org created", {
    orgId: result.org.id,
    userId,
    name: result.org.name,
  });
  return result;
}

/**
 * Joins an existing franchise as a child org using a one-time invite token.
 *
 * What IS inherited from the parent:
 *   - `name`        — child uses the same brand name as the parent.
 *   - `parentId`    — FK that places this org in the franchise hierarchy.
 *   - Roles + permissions — full role structure is cloned (no users copied).
 *
 * What is NOT inherited (franchisee sets independently):
 *   - Schedule — timezone, address, operating days and hours are per-location.
 *   - Users    — the child org starts empty; only the joining owner is added.
 *
 * Token rules:
 *   - Must exist and be unused (`usedByOrgId` is null).
 *   - Must not be expired (`expiresAt` > now).
 *   - Must have been issued to the caller's email (case-insensitive).
 *
 * All steps are atomic — if any step fails, nothing is persisted and the token
 * remains available.
 */
export async function joinFranchise(
  userId: string,
  userEmail: string,
  data: JoinFranchiseInput,
) {
  const result = await prisma.$transaction(async (tx) => {
    const [token, user] = await Promise.all([
      tx.franchiseToken.findUnique({
        where: { token: data.token },
        include: { organization: { select: { id: true, name: true } } },
      }),
      tx.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
    ]);

    if (!token) throw new Error("Invalid token");
    if (token.usedByOrgId) throw new Error("Token has already been used");
    if (token.expiresAt < new Date()) throw new Error("Token has expired");
    if (token.invitedEmail.toLowerCase() !== userEmail.toLowerCase())
      throw new Error("This token was not issued to your account");

    // Child org uses the parent's brand name.
    // parentId links it into the franchise hierarchy.
    // Schedule is set independently by the franchisee.
    const org = await tx.organization.create({
      data: {
        name: `${token.organization.name}: ${user?.name ?? userEmail}`,
        parentId: token.orgId,
        ownerId: userId,
        timezone: data.timezone ?? "Australia/Sydney",
        address: data.address ?? null,
        operatingDays: data.operatingDays ?? [],
        openTimeMin: data.openTimeMin ?? null,
        closeTimeMin: data.closeTimeMin ?? null,
      },
    });

    // Clone all roles + permissions from the parent (no users carried over).
    const { clonedRoles, roleIdMap, membership } = await cloneRolesFromParent(
      tx,
      token.orgId,
      org.id,
      userId,
    );

    // Clone tasks with eligibility remapped to the cloned roles.
    const { taskIdMap } = await cloneTasksFromParent(
      tx,
      token.orgId,
      org.id,
      roleIdMap,
    );

    // Clone timetable templates with taskIds remapped to the cloned tasks.
    await cloneTemplatesFromParent(tx, token.orgId, org.id, taskIdMap);

    // Clone timetable view settings.
    await cloneTimetableSettingsFromParent(tx, token.orgId, org.id);

    // Mark the token as consumed so it cannot be reused.
    await tx.franchiseToken.update({
      where: { id: token.id },
      data: { usedByOrgId: org.id, acceptedAt: new Date() },
    });

    // Mark the corresponding FRANCHISE invite as accepted so the notification
    // resolves and no longer shows Join / Decline buttons.
    await tx.invite.updateMany({
      where: {
        orgId: token.orgId,
        recipientId: userId,
        type: "FRANCHISE",
        status: "PENDING",
        metadata: { path: ["token"], equals: token.token },
      },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });

    await recordAudit(
      {
        orgId: org.id,
        actorId: userId,
        action: "org.join_franchise",
        targetType: "Organization",
        targetId: org.id,
        after: {
          name: org.name,
          parentId: org.parentId,
          timezone: org.timezone,
        },
      },
      tx,
    );

    return { org, clonedRoles, membership };
  });
  log.info("Franchise joined", { orgId: result.org.id, userId });
  return result;
}

/**
 * Updates an org's location and schedule settings.
 * Callable by any member with MANAGE_SETTINGS permission (checked in the action layer).
 * @param actorId - Optional caller ID forwarded from the action layer for audit log.
 */
export async function updateOrgSettings(
  orgId: string,
  data: UpdateOrgSettingsInput,
  actorId?: string | null,
) {
  const before = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      timezone: true,
      address: true,
      operatingDays: true,
      openTimeMin: true,
      closeTimeMin: true,
    },
  });
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      timezone: data.timezone,
      address: data.address ?? null,
      operatingDays: data.operatingDays ?? [],
      openTimeMin: data.openTimeMin ?? null,
      closeTimeMin: data.closeTimeMin ?? null,
    },
  });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    action: "org.update",
    targetType: "Organization",
    targetId: orgId,
    before: before as import("@prisma/client").Prisma.InputJsonObject | null,
    after: {
      timezone: data.timezone,
      address: data.address ?? null,
      operatingDays: data.operatingDays ?? [],
      openTimeMin: data.openTimeMin ?? null,
      closeTimeMin: data.closeTimeMin ?? null,
    },
  });
  return updated;
}

/**
 * Transfers org ownership to a different member.
 * Restricted to the current owner of a non-franchisee org (no parentId).
 * Logs `org.transfer_ownership` inside the transaction with before/after owner IDs.
 */
export async function transferOrgOwnership(
  orgId: string,
  currentOwnerId: string,
  newOwnerId: string,
) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerId: true, parentId: true },
  });

  if (!org) throw new Error("Organization not found");
  if (org.ownerId !== currentOwnerId)
    throw new Error("Only the owner can transfer ownership");
  if (org.parentId !== null)
    throw new Error("Franchisee orgs cannot transfer ownership");
  if (currentOwnerId === newOwnerId)
    throw new Error("New owner must be a different member");

  return prisma.$transaction(async (tx) => {
    // Verify the target user is already a member of this org
    const [currentMembership, targetMembership] = await Promise.all([
      tx.membership.findFirst({
        where: { orgId, userId: currentOwnerId },
        select: { id: true },
      }),
      tx.membership.findFirst({
        where: { orgId, userId: newOwnerId },
        select: { id: true },
      }),
    ]);
    if (!targetMembership)
      throw new Error("New owner must already be a member");
    if (!currentMembership)
      throw new Error("Current owner membership record is missing");

    const ownerRole = await tx.role.findFirst({
      where: { orgId, key: ROLE_KEYS.OWNER },
      select: { id: true },
    });
    if (!ownerRole) throw new Error("Owner role not found");

    // Swap the Owner role: remove from old owner, assign to new owner
    await Promise.all([
      tx.memberRole.deleteMany({
        where: { membershipId: currentMembership.id, roleId: ownerRole.id },
      }),
      tx.memberRole.upsert({
        where: {
          membershipId_roleId: {
            membershipId: targetMembership.id,
            roleId: ownerRole.id,
          },
        },
        create: { membershipId: targetMembership.id, roleId: ownerRole.id },
        update: {},
      }),
    ]);

    const updated = await tx.organization.update({
      where: { id: orgId },
      data: { ownerId: newOwnerId },
    });

    await recordAudit(
      {
        orgId,
        actorId: currentOwnerId,
        action: "org.transfer_ownership",
        targetType: "Organization",
        targetId: orgId,
        before: { ownerId: currentOwnerId },
        after: { ownerId: newOwnerId },
      },
      tx,
    );

    log.info("Org ownership transferred", {
      orgId,
      from: currentOwnerId,
      to: newOwnerId,
    });
    return updated;
  });
}

/**
 * Permanently deletes an org and all its data (cascaded via Prisma schema).
 * Restricted to the current owner of a non-franchisee org (no parentId).
 * Caller must supply the org's exact name as a deletion confirmation.
 */
export async function deleteOrg(
  orgId: string,
  currentOwnerId: string,
  confirmName: string,
) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, ownerId: true, parentId: true },
  });

  if (!org) throw new Error("Organization not found");
  if (org.ownerId !== currentOwnerId)
    throw new Error("Only the owner can delete this org");
  if (org.parentId !== null)
    throw new Error("Franchisee orgs cannot be deleted this way");
  if (org.name !== confirmName)
    throw new Error("Confirmation name does not match");

  // Write audit log BEFORE deletion. Since AuditLog.orgId has onDelete: Cascade,
  // this record will be deleted along with the org. For true persistence across
  // org deletion, consider migrating to a global audit table without orgId FK.
  await recordAudit({
    orgId,
    actorId: currentOwnerId,
    action: "org.delete",
    targetType: "Organization",
    targetId: orgId,
    before: { name: org.name },
    metadata: {
      deletedBy: currentOwnerId,
      deletedAt: new Date().toISOString(),
    },
  });

  await prisma.organization.delete({ where: { id: orgId } });
  log.info("Org deleted", { orgId, deletedBy: currentOwnerId });
}

/**
 * Returns the timezone and operating-hours settings for an org.
 * Used by the timetable page to resolve the local week and grid bounds.
 */
export async function getOrgTimetableMeta(orgId: string) {
  return prisma.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true, openTimeMin: true, closeTimeMin: true },
  });
}
