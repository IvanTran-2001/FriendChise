import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { auth } from "@/auth";
import { headers } from "next/headers";
import { decode } from "next-auth/jwt";
import { log } from "@/lib/platform/observability";
import { prisma } from "@/lib/platform/prisma";
import {
  getAuthUser,
  getOrgMembership,
  isOrgOwner,
  memberHasPermission,
} from "./_shared";

const MOBILE_TOKEN_COOKIE_NAME = "friendchise.mobile-session-token";

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
  const session = await auth();
  const sessionUserId = session?.user?.id as string | undefined;
  const sessionUserEmail = (session?.user?.email as string | undefined) ?? null;
  if (sessionUserId) {
    return {
      ok: true as const,
      userId: sessionUserId,
      userEmail: sessionUserEmail,
      authMethod: "session" as const,
    };
  }

  const authorization = (await headers()).get("authorization");
  if (!authorization?.startsWith("Bearer ")) return { ok: false as const, response: unauthorized() };

  const rawToken = authorization.slice(7);
  const secret = process.env.AUTH_SECRET;
  if (!secret) return { ok: false as const, response: unauthorized() };

  let decoded;
  try {
    decoded = await decode({
      token: rawToken,
      secret,
      salt: MOBILE_TOKEN_COOKIE_NAME,
    });
  } catch {
    return { ok: false as const, response: unauthorized() };
  }

  if (!decoded?.sub) return { ok: false as const, response: unauthorized() };

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true },
  });
  if (!user) return { ok: false as const, response: unauthorized() };

  return {
    ok: true as const,
    userId: user.id,
    userEmail: (decoded.email as string | undefined) ?? null,
    authMethod: "bearer" as const,
  };
}

/** Requires the caller to be the owner of the given org. */
export async function requireOrgOwner(orgId: string) {
  const user = await getAuthUser();
  if (!user) return { ok: false as const, response: unauthorized() };

  if (!(await isOrgOwner(orgId, user.id))) {
    return { ok: false as const, response: forbidden() };
  }

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
