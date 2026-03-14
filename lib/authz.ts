import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { OrgPermission } from "@prisma/client";

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
    select: { id: true, orgId: true, userId: true, roleId: true },
  });

  if (!membership) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, userId, membership };
}

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

export async function requireOrgPermission(
  orgId: string,
  permission: OrgPermission,
) {
  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz;

  const { membership } = authz;

  if (!membership.roleId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Permission denied" },
        { status: 403 },
      ),
    };
  }

  const rolePermission = await prisma.rolePermission.findFirst({
    where: { roleId: membership.roleId, permission, role: { is: { orgId } } },
    select: { id: true },
  });

  if (!rolePermission) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Permission denied" },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, userId: membership.userId, membership };
}
