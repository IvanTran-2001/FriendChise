import { NextResponse } from "next/server";
import { createTaskSchema } from "@/lib/validators/task";
import { requireOrgMember, requireOrgPermission } from "@/lib/authz";
import { OrgPermission } from "@prisma/client";
import z from "zod";
import { createTask, deleteTask, getTasks } from "@/lib/services/tasks";

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
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const task = await createTask(orgId, parsed.data);
  return NextResponse.json(task, { status: 201 });
}

const deleteTaskSchema = z.object({ id: z.string() });

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
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await deleteTask(orgId, parsed.data.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ message: "Task deleted successfully" }, { status: 200 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const tasks = await getTasks(orgId);
  return NextResponse.json(tasks);
}
