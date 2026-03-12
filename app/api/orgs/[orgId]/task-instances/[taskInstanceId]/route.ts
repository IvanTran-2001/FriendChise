import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/authz";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; taskInstanceId: string }> },
) {
  const { orgId, taskInstanceId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const item = await prisma.taskInstance.findFirst({
    where: { orgId, id: taskInstanceId },
  });

  if (!item) {
    return NextResponse.json(
      { error: "Task instance not found in this org" },
      { status: 404 },
    );
  }

  return NextResponse.json(item, { status: 200 });
}
