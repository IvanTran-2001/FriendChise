import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PermissionAction } from "@prisma/client";

/** Returns the authenticated user's id, or null if not signed in. */
export async function getAuthUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user?.id as string | undefined) ?? null;
}

/** Returns the membership row if the user belongs to the org, or null. */
export async function getOrgMembership(orgId: string, userId: string) {
  return prisma.membership.findFirst({
    where: { orgId, userId },
    select: { id: true, orgId: true, userId: true },
  });
}

/** Returns true if the user is the owner of an org that has no parent (i.e. a parent org). */
export async function isParentOrgOwner(orgId: string, userId: string): Promise<boolean> {
  const org = await prisma.organization.findFirst({
    where: { id: orgId, ownerId: userId, parentId: null },
    select: { id: true },
  });
  return org !== null;
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
