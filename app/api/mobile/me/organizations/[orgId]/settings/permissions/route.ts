import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { getAuthUserId, getOrgMembership, isOrgOwnerOrParentOrgOwner, memberHasPermission } from "@/lib/authz/_shared";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json(
      {
        canManageOrgSettings: false,
        canManageRoles: false,
        canManageSettings: false,
      },
      { status: 200 },
    );
  }

  const { orgId } = await params;
  const membership = await getOrgMembership(orgId, userId);
  if (!membership) {
    return NextResponse.json(
      {
        canManageOrgSettings: false,
        canManageRoles: false,
        canManageSettings: false,
      },
      { status: 200 },
    );
  }

  const [isOwner, canManageRoles, canManageSettings] = await Promise.all([
    isOrgOwnerOrParentOrgOwner(orgId, userId),
    memberHasPermission(membership.id, orgId, PermissionAction.MANAGE_ROLES),
    memberHasPermission(membership.id, orgId, PermissionAction.MANAGE_SETTINGS),
  ]);

  return NextResponse.json({
    canManageOrgSettings: isOwner,
    canManageRoles: isOwner || canManageRoles,
    canManageSettings: isOwner || canManageSettings,
  });
}