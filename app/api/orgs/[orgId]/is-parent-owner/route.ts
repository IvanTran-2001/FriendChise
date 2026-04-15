import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const authz = await requireUser();
  if (!authz.ok) return authz.response;

  const { orgId } = await params;

  // Case 1: current org is a root org owned by this user
  const parentOrg = await prisma.organization.findFirst({
    where: { id: orgId, ownerId: authz.userId, parentId: null },
    select: { id: true },
  });
  if (parentOrg) {
    return NextResponse.json({ isParentOwner: true, parentOrgId: null });
  }

  // Case 2: current org is a child org whose parent is owned by this user
  const childOrg = await prisma.organization.findFirst({
    where: { id: orgId, parentId: { not: null } },
    select: { parentId: true },
  });
  if (childOrg?.parentId) {
    const ownedParent = await prisma.organization.findFirst({
      where: { id: childOrg.parentId, ownerId: authz.userId, parentId: null },
      select: { id: true },
    });
    if (ownedParent) {
      return NextResponse.json({
        isParentOwner: false,
        parentOrgId: ownedParent.id,
      });
    }
  }

  return NextResponse.json({ isParentOwner: false, parentOrgId: null });
}
