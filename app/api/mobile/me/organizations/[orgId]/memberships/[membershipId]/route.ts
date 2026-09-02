import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/authz";
import { deleteMembership, getMembershipDetail, updateMembership } from "@/lib/services/memberships";

type RouteContext = { params: Promise<{ orgId: string; membershipId: string }> };

const updateSchema = z.object({
  roleIds: z.array(z.string().trim().min(1)).min(1, "At least one role is required"),
});

export async function PATCH(req: Request, { params }: RouteContext) {
  const { orgId, membershipId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_MEMBERS);
  if (!authz.ok) return authz.response;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        errors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const membership = await getMembershipDetail(orgId, membershipId);
  if (!membership) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  const result = await updateMembership(
    orgId,
    membershipId,
    { roleIds: parsed.data.roleIds },
    authz.userId,
    authz.userEmail,
  );

  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "INVALID" ? 400 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}

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
