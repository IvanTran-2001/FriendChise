import { NextResponse } from "next/server";
import { Prisma, OrgPermission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/lib/authz";
import { createMembershipSchema, deleteMembershipSchema } from "@/lib/validators/membership";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, OrgPermission.ORG_MANAGE);
  if (!authz.ok) return authz.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createMembershipSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (data.roleId) {
    // Verify the role exists and belongs to this org
    const role = await prisma.role.findFirst({
      where: { id: data.roleId, orgId },
    });
    if (!role) {
      return NextResponse.json(
        { error: "Invalid roleId: not found or does not belong to this org" },
        { status: 400 },
      );
    }
  }

  const user = await prisma.user.findFirst({
    where: { id: data.userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: "Invalid userId: not found" },
      { status: 400 },
    );
  }

  try {
    const membership = await prisma.membership.create({
      data: {
        orgId,
        userId: data.userId,
        roleId: data.roleId,
      },
    });

    return NextResponse.json(membership, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: "Membership already exists" },
          { status: 409 },
        );
      }
      if (e.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid foreign key reference" },
          { status: 400 },
        );
      }
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, OrgPermission.ORG_MANAGE);
  if (!authz.ok) return authz.response;

  const json = await req.json().catch(() => null);
  const parsed = deleteMembershipSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { userId } = parsed.data;

  // Ensure the user being deleted is not the org owner (which would orphan the org)
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerUserId: true },
  });
  if (!org)
    return NextResponse.json({ error: "Org not found" }, { status: 404 });

  if (userId === org.ownerUserId) {
    return NextResponse.json(
      { error: "Cannot remove the organization owner" },
      { status: 400 },
    );
  }

  // Ensure scoped to org (prevents cross-org deletes)
  const { count } = await prisma.membership.deleteMany({
    where: { userId, orgId },
  });

  if (count === 0) {
    return NextResponse.json(
      { error: "Membership not found" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, OrgPermission.ORG_MANAGE);
  if (!authz.ok) return authz.response;

  const memberships = await prisma.membership.findMany({
    where: { orgId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      role: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(memberships);
}
