import { redirect } from "next/navigation";
import { PermissionAction } from "@prisma/client";
import {
  getAuthUserId,
  getOrgMembership,
  isParentOrgOwner,
  memberHasPermission,
} from "./_shared";

/**
 * Auth guard helpers for server component pages.
 *
 * These call redirect() directly so they can be used inside async page
 * components and server actions that render UI.
 *
 * Usage:
 *   await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_SETTINGS);
 */

/** Requires the caller to be signed in (any authenticated user). */
export async function requireUserPage({
  redirectTo = "/signin",
} = {}): Promise<{ userId: string }> {
  const userId = await getAuthUserId();
  if (!userId) redirect(redirectTo);
  return { userId };
}

/**
 * - Not signed in  → redirects to /signin
 * - Not a member   → redirects to redirectTo (default: /)
 * - Otherwise      → returns { userId }
 */
export async function requireOrgMemberPage(
  orgId: string,
  { redirectTo }: { redirectTo?: string } = {},
): Promise<{ userId: string }> {
  const userId = await getAuthUserId();
  if (!userId) redirect("/signin");

  const membership = await getOrgMembership(orgId, userId);
  if (!membership) redirect(redirectTo ?? `/orgs/${orgId}`);

  return { userId };
}

/**
 * - Not signed in      → redirects to /signin
 * - Not a member       → redirects to redirectTo (default: /)
 * - Permission denied  → redirects to redirectTo (default: /)
 * - Otherwise          → returns { userId }
 */
/**
 * Requires the caller to be the owner of a parent org (no parentId).
 * Redirects to / if not signed in or not the parent org owner.
 */
export async function requireParentOrgOwnerPage(
  orgId: string,
  { redirectTo = "/" } = {},
): Promise<{ userId: string }> {
  const userId = await getAuthUserId();
  if (!userId) redirect("/signin");
  if (!(await isParentOrgOwner(orgId, userId))) redirect(redirectTo);
  return { userId };
}

export async function requireOrgPermissionPage(
  orgId: string,
  permission: PermissionAction,
  { redirectTo }: { redirectTo?: string } = {},
): Promise<{ userId: string }> {
  const userId = await getAuthUserId();
  if (!userId) redirect("/signin");

  const membership = await getOrgMembership(orgId, userId);
  if (!membership) redirect(redirectTo ?? `/orgs/${orgId}`);

  if (!(await memberHasPermission(membership.id, orgId, permission)))
    redirect(redirectTo ?? `/orgs/${orgId}`);

  return { userId };
}
