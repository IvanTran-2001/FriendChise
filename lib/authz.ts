import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { PermissionAction } from "@prisma/client";

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

/** Requires the caller to be signed in and a member of the given org. */
export async function requireOrgMember(orgId: string) {
  const session = await auth();

  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const membership = await prisma.membership.findFirst({
    where: { orgId, userId },
    select: { id: true, orgId: true, userId: true },
  });

  if (!membership) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, userId, membership };
}

/** Requires the caller to be signed in (any authenticated user). */
export async function requireUser() {
  const session = await auth();

  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true as const, userId };
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

  const { membership } = authz;

  const hasPermission = await prisma.permission.findFirst({
    where: {
      action: permission,
      role: {
        orgId,
        memberRoles: { some: { membershipId: membership.id } },
      },
    },
    select: { id: true },
  });

  if (!hasPermission) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Permission denied" },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, userId: authz.userId, membership };
}
