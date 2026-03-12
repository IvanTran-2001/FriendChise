import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, OrgPermission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, requireOrgPermission } from "@/lib/authz";

const assigneeSchema = z.object({
  membershipId: z.string(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; taskInstanceId: string }> },
) {
  const { orgId, taskInstanceId } = await params;

  const authz = await requireOrgPermission(orgId, OrgPermission.TASK_ASSIGN);
  if (!authz.ok) return authz.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = assigneeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { membershipId } = parsed.data;

  // task instance must exist in this org
  const taskInstance = await prisma.taskInstance.findFirst({
    where: { id: taskInstanceId, orgId },
    select: { id: true },
  });
  if (!taskInstance) {
    return NextResponse.json(
      { error: "Task instance not found in this org" },
      { status: 404 },
    );
  }

  // membership must exist in this org
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, orgId },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "Membership not found in this org" },
      { status: 404 },
    );
  }

  try {
    const assignee = await prisma.taskInstanceAssignee.create({
      data: { taskInstanceId, membershipId },
    });
    return NextResponse.json(assignee, { status: 201 });
  } catch (e: unknown) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Assignee already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; taskInstanceId: string }> },
) {
  const { orgId, taskInstanceId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const assignees = await prisma.taskInstanceAssignee.findMany({
    where: {
      taskInstanceId,
      taskInstance: { is: { orgId } },
    },
    include: {
      membership: {
        include: {
          user: {
            select: { id: true, name: true },
          },
          role: {
            select: { id: true, title: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(assignees);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string; taskInstanceId: string }> },
) {
  const { orgId, taskInstanceId } = await params;

  const authz = await requireOrgPermission(orgId, OrgPermission.TASK_ASSIGN);
  if (!authz.ok) return authz.response;

  const json = await req.json().catch(() => null);
  const parsed = assigneeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { membershipId } = parsed.data;

  // Ensure scoped to org (prevents cross-org deletes)
  const link = await prisma.taskInstanceAssignee.findFirst({
    where: {
      taskInstanceId,
      membershipId,
      taskInstance: { is: { orgId } },
      membership: { is: { orgId } },
    },
    select: { id: true },
  });

  if (!link) {
    return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
  }

  await prisma.taskInstanceAssignee.delete({ where: { id: link.id } });
  return NextResponse.json({ ok: true });
}
