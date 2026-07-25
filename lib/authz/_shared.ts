import { headers } from "next/headers";
import { decode } from "next-auth/jwt";
import { auth } from "@/auth";
import { prisma } from "@/lib/platform/prisma";
import { PermissionAction } from "@prisma/client";

const MOBILE_TOKEN_COOKIE_NAME = "friendchise.mobile-session-token";

/** Returns the authenticated user's id and email, or null if not signed in. */
export async function getAuthUser(): Promise<{
  id: string;
  email: string | null;
} | null> {
  const session = await auth();
  const id = session?.user?.id as string | undefined;
  const email = (session?.user?.email as string | undefined) ?? null;

  if (id) return { id, email };

  const authorization = (await headers()).get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const rawToken = authorization.slice(7);
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const decoded = await decode({
    token: rawToken,
    secret,
    salt: MOBILE_TOKEN_COOKIE_NAME,
  });

  if (!decoded?.sub) return null;
  return { id: decoded.sub, email: (decoded.email as string | undefined) ?? null };
}

/** Returns the authenticated user's id, or null if not signed in. */
export async function getAuthUserId(): Promise<string | null> {
  const user = await getAuthUser();
  return user?.id ?? null;
}

/** Returns the membership row if the user belongs to the org, or null. */
export async function getOrgMembership(orgId: string, userId: string) {
  return prisma.membership.findFirst({
    where: { orgId, userId },
    select: { id: true, orgId: true, userId: true },
  });
}

/** Returns true if the user is the owner of an org that has no parent (i.e. a parent org). */
export async function isParentOrgOwner(
  orgId: string,
  userId: string,
): Promise<boolean> {
  const org = await prisma.organization.findFirst({
    where: { id: orgId, ownerId: userId, parentId: null },
    select: { id: true },
  });
  return org !== null;
}

/** Returns true if the given email belongs to an AdminUser row. */
export async function isAdminUser(email: string | null): Promise<boolean> {
  if (!email) return false;

  // In local development, any signed-in user can access admin surfaces so the
  // admin panel is usable without seeding an AdminUser row.
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // Normalize email: trim whitespace and lowercase
  const normalizedEmail = email.trim().toLowerCase();
  const admin = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  return admin !== null;
}

/** Returns true if the user is the owner of the given org. */
export async function isOrgOwner(
  orgId: string,
  userId: string,
): Promise<boolean> {
  const org = await prisma.organization.findFirst({
    where: { id: orgId, ownerId: userId },
    select: { id: true },
  });
  return org !== null;
}

/** Returns true if the user owns the org or its parent org. */
export async function isOrgOwnerOrParentOrgOwner(
  orgId: string,
  userId: string,
): Promise<boolean> {
  const org = await prisma.organization.findFirst({
    where: { id: orgId },
    select: {
      ownerId: true,
      parent: { select: { ownerId: true } },
    },
  });

  if (!org) return false;

  return org.ownerId === userId || org.parent?.ownerId === userId;
}

/** Returns true if the membership's role(s) grant the given permission. */
export async function memberHasPermission(
  membershipId: string,
  orgId: string,
  permission: PermissionAction,
): Promise<boolean> {
  const hit = await prisma.permission.findFirst({
    where: {
      action: permission,
      role: { orgId, memberRoles: { some: { membershipId } } },
    },
    select: { id: true },
  });
  return hit !== null;
}
