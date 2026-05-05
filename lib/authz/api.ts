import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { log } from "@/lib/observability";
import { getAuthUser, getOrgMembership, memberHasPermission } from "./_shared";

/**
 * Auth guard helpers for API route handlers.
 *
 * Each function returns a discriminated union:
 *   { ok: true, userId, membership? }  — proceed
 *   { ok: false, response }            — return this NextResponse immediately
 *
 * Usage:
 *   const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_TASKS);
 *   if (!authz.ok) return authz.response;
 */

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const forbidden = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403 });
const permissionDenied = () =>
  NextResponse.json({ error: "Permission denied" }, { status: 403 });

/** Requires the caller to be signed in (any authenticated user). */
export async function requireUser() {
  const user = await getAuthUser();
  if (!user) return { ok: false as const, response: unauthorized() };
  return { ok: true as const, userId: user.id, userEmail: user.email };
}

/** Requires the caller to be signed in and a member of the given org. */
export async function requireOrgMember(orgId: string) {
  const user = await getAuthUser();
  if (!user) return { ok: false as const, response: unauthorized() };

  const membership = await getOrgMembership(orgId, user.id);
  if (!membership) return { ok: false as const, response: forbidden() };

  return {
    ok: true as const,
    userId: user.id,
    userEmail: user.email,
    membership,
  };
}

/**
 * Requires the caller to be a member of the org whose role(s) grant the given
 * permission. Checks the Permission table via the MemberRole junction so a
 * membership with multiple roles is handled correctly.
 */
export async function requireOrgPermission(
  orgId: string,
  permission: PermissionAction,
) {
  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz;

  if (!(await memberHasPermission(authz.membership.id, orgId, permission))) {
    log.warn("Permission denied", {
      orgId,
      permission,
    });
    return { ok: false as const, response: permissionDenied() };
  }

  return {
    ok: true as const,
    userId: authz.userId,
    userEmail: authz.userEmail,
    membership: authz.membership,
  };
}
