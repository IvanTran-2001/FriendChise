import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/authz/_shared";
import { prisma } from "@/lib/platform/prisma";

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { organization: { name: "asc" } },
    select: {
      orgId: true,
      organization: {
        select: { id: true, name: true },
      },
    },
  });

  if (!membership?.organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({
    organization: membership.organization,
    orgId: membership.orgId,
  });
}