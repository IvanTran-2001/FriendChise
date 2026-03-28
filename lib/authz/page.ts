import { redirect } from "next/navigation";
import { PermissionAction } from "@prisma/client";
import {
  getAuthUserId,
  getOrgMembership,
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
  { redirectTo = "/" } = {},
): Promise<{ userId: string }> {
  const userId = await getAuthUserId();
  if (!userId) redirect("/signin");

  const membership = await getOrgMembership(orgId, userId);
  if (!membership) redirect(redirectTo);

  return { userId };
}

/**
 * - Not signed in      → redirects to /signin
 * - Not a member       → redirects to redirectTo (default: /)
 * - Permission denied  → redirects to redirectTo (default: /)
 * - Otherwise          → returns { userId }
 */
export async function requireOrgPermissionPage(
  orgId: string,
  permission: PermissionAction,
  { redirectTo = "/" } = {},
): Promise<{ userId: string }> {
  const userId = await getAuthUserId();
  if (!userId) redirect("/signin");

  const membership = await getOrgMembership(orgId, userId);
  if (!membership) redirect(redirectTo);

  if (!(await memberHasPermission(membership.id, orgId, permission)))
    redirect(redirectTo);

  return { userId };
}
