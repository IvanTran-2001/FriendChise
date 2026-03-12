import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { OrgPermission } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/rbac";

const createOrgSchema = z.object({
  title: z.string().min(1).max(200),
  openTimeMin: z.number().int().min(0).max(1439).optional(),
  closeTimeMin: z.number().int().min(0).max(1439).optional(),
});

export async function POST(req: Request) {
  const authz = await requireUser();
  if (!authz.ok) return authz.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createOrgSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (
    data.openTimeMin != null &&
    data.closeTimeMin != null &&
    data.openTimeMin >= data.closeTimeMin
  ) {
    return NextResponse.json(
      { error: "openTimeMin must be less than closeTimeMin" },
      { status: 400 },
    );
  }

  const ownerPermissions: OrgPermission[] = [
    OrgPermission.ORG_MANAGE,
    OrgPermission.ROLE_MANAGE,
    OrgPermission.TASK_CREATE,
    OrgPermission.TASK_UPDATE,
    OrgPermission.TASK_DELETE,
    OrgPermission.TASK_ASSIGN,
    OrgPermission.TASKINSTANCE_COMPLETE,
  ];

  const workerPermissions: OrgPermission[] = [
    OrgPermission.TASKINSTANCE_COMPLETE,
  ];

  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        title: data.title,
        ownerUserId: authz.userId,
        openTimeMin: data.openTimeMin ?? null,
        closeTimeMin: data.closeTimeMin ?? null,
      },
    });

    const [ownerRole, memberRole] = await Promise.all([
      tx.role.create({ data: { orgId: org.id, title: "Owner", key: ROLE_KEYS.OWNER } }),
      tx.role.create({ data: { orgId: org.id, title: "Member", key: ROLE_KEYS.DEFAULT_MEMBER } }),
    ]);

    await tx.rolePermission.createMany({
      data: [
        ...ownerPermissions.map((permission) => ({
          roleId: ownerRole.id,
          permission,
        })),
        ...workerPermissions.map((permission) => ({
          roleId: memberRole.id,
          permission,
        })),
      ],
      skipDuplicates: true,
    });

    const membership = await tx.membership.create({
      data: {
        orgId: org.id,
        userId: authz.userId,
        roleId: ownerRole.id,
      },
    });

    return { org, ownerRole, memberRole, membership };
  });

  return NextResponse.json(result, { status: 201 });
}
