import { PermissionAction } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import {
  getAuthUserId,
  getOrgMembership,
  isParentOrgOwner,
  memberHasPermission,
} from "./_shared";

/**
 * Auth guard helpers for server actions.
 *
 * Server actions are a third rendering context — they're not API route handlers
 * (so returning NextResponse is meaningless) and they're not page components
 * (so calling redirect() would skip the caller's own error-return logic).
 *
 * These helpers return a plain discriminated union the action can pattern-match
 * on, with no side effects:
 *   { ok: true, userId, membership? }  — proceed
 *   { ok: false }                      — return your action's failure state
 *
 * Usage:
 *   const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
 *   if (!authz.ok) return { ok: false, errors: { _: ["Unauthorized"] } };
 */

/** Requires the caller to be signed in. */
export async function requireUserAction() {
  const userId = await getAuthUserId();
  if (!userId) return { ok: false as const };
  return { ok: true as const, userId };
}

/** Requires the caller to be signed in and a member of the org. */
export async function requireOrgMemberAction(orgId: string) {
  const userId = await getAuthUserId();
  if (!userId) return { ok: false as const };

  const membership = await getOrgMembership(orgId, userId);
  if (!membership) return { ok: false as const };

  return { ok: true as const, userId, membership };
}

/** Requires the caller to be the owner of a parent org (no parentId). */
export async function requireParentOrgOwnerAction(orgId: string) {
  const userId = await getAuthUserId();
  if (!userId) return { ok: false as const };
  if (!(await isParentOrgOwner(orgId, userId))) return { ok: false as const };
  return { ok: true as const, userId };
}

/** Requires the caller to be a member of the org with the given permission. */
export async function requireOrgPermissionAction(
  orgId: string,
  permission: PermissionAction,
) {
  const authz = await requireOrgMemberAction(orgId);
  if (!authz.ok) return authz;

  if (!(await memberHasPermission(authz.membership.id, orgId, permission))) {
    Sentry.logger.warn("Permission denied", { orgId, permission, userId: authz.userId });
    return { ok: false as const };
  }

  return {
    ok: true as const,
    userId: authz.userId,
    membership: authz.membership,
  };
}
