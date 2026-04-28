import { PermissionAction } from "@prisma/client";
import { log } from "@/lib/observability";
import {
  getAuthUser,
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
  const user = await getAuthUser();
  if (!user) return { ok: false as const };
  return { ok: true as const, userId: user.id, userEmail: user.email };
}

/** Requires the caller to be signed in and a member of the org. */
export async function requireOrgMemberAction(orgId: string) {
  const user = await getAuthUser();
  if (!user) return { ok: false as const };

  const membership = await getOrgMembership(orgId, user.id);
  if (!membership) return { ok: false as const };

  return {
    ok: true as const,
    userId: user.id,
    userEmail: user.email,
    membership,
  };
}

/** Requires the caller to be the owner of a parent org (no parentId). */
export async function requireParentOrgOwnerAction(orgId: string) {
  const user = await getAuthUser();
  if (!user) return { ok: false as const };
  if (!(await isParentOrgOwner(orgId, user.id))) return { ok: false as const };
  return { ok: true as const, userId: user.id, userEmail: user.email };
}

/** Requires the caller to be a member of the org with the given permission. */
export async function requireOrgPermissionAction(
  orgId: string,
  permission: PermissionAction,
) {
  const authz = await requireOrgMemberAction(orgId);
  if (!authz.ok) return authz;

  if (!(await memberHasPermission(authz.membership.id, orgId, permission))) {
    log.warn("Permission denied", {
      orgId,
      permission,
    });
    return { ok: false as const };
  }

  return {
    ok: true as const,
    userId: authz.userId,
    userEmail: authz.userEmail,
    membership: authz.membership,
  };
}
