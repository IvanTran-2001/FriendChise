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

  const org = await prisma.organization.findFirst({
    where: { id: orgId, ownerId: authz.userId, parentId: null },
    select: { id: true },
  });

  return NextResponse.json({ isParentOwner: org !== null });
}
