import { NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/authz";
import { deleteMembership } from "@/lib/services/memberships";
import { PermissionAction } from "@prisma/client";

type RouteContext = { params: Promise<{ orgId: string; membershipId: string }> };

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { orgId, membershipId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_MEMBERS);
  if (!authz.ok) return authz.response;

  const result = await deleteMembership(orgId, membershipId, authz.userId, authz.userEmail);
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND"
        ? 404
        : result.error === "Cannot remove the organization owner"
          ? 403
          : 400;

    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}