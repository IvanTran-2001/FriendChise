import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/authz";
import { deleteRole, updateRole } from "@/lib/services/roles";
import { roleFormSchema } from "@/lib/validators/role";

type RouteContext = { params: Promise<{ orgId: string; roleId: string }> };

function jsonRoleMutationError(
  error: string,
  code?: "NOT_FOUND" | "INVALID" | "CONFLICT" | "FORBIDDEN",
) {
  const status = code === "NOT_FOUND" ? 404 : code === "FORBIDDEN" ? 403 : 400;
  return NextResponse.json({ error }, { status });
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const { orgId, roleId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_ROLES);
  if (!authz.ok) return authz.response;

  const body = await req.json().catch(() => null);
  const parsed = roleFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        errors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const result = await updateRole(
    orgId,
    roleId,
    parsed.data,
    authz.userId,
    authz.userEmail,
  );

  if (!result.ok) {
    return jsonRoleMutationError(result.error, result.code);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { orgId, roleId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_ROLES);
  if (!authz.ok) return authz.response;

  const result = await deleteRole(orgId, roleId, authz.userId, authz.userEmail);
  if (!result.ok) {
    return jsonRoleMutationError(result.error, result.code);
  }

  return NextResponse.json({ ok: true });
}