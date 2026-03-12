import { NextResponse } from "next/server";
import { createTaskSchema } from "@/lib/validators/task";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, requireOrgPermission } from "@/lib/authz";
import z from "zod";
import { OrgPermission } from "@prisma/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, OrgPermission.TASK_CREATE);
  if (!authz.ok) return authz.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createTaskSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const task = await prisma.task.create({
    data: {
      orgId,
      title: data.title,
      description: data.description ?? null,
      durationMin: data.durationMin,
      preferredStartTimeMin: data.preferredStartTimeMin ?? null,
      peopleRequired: data.peopleRequired ?? 1,
      minWaitDays: data.minWaitDays ?? null,
      maxWaitDays: data.maxWaitDays ?? null,
    },
  });

  return NextResponse.json(task, { status: 201 });
}

const deleteTaskSchema = z.object({
  id: z.string(),
});

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, OrgPermission.TASK_DELETE);
  if (!authz.ok) return authz.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = deleteTaskSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const { id } = parsed.data;

  const link = await prisma.task.findFirst({
    where: {
      id,
      orgId,
    },
    select: { id: true },
  });

  if (!link) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.task.delete({
    where: { id: link.id },
  });

  return NextResponse.json(
    { message: "Task deleted successfully" },
    { status: 200 },
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const tasks = await prisma.task.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tasks);
}
