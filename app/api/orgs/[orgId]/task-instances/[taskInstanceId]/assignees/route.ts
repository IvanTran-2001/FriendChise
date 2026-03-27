/**
 * REST endpoint: /api/orgs/[orgId]/task-instances/[taskInstanceId]/assignees
 *
 * GET    — List all assignees for the task instance. Any org member may call this.
 * POST   — Assign a member to the task instance. Requires TASK_ASSIGN permission.
 * DELETE — Remove an assignee from the task instance. Requires TASK_ASSIGN permission.
 */
import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { requireOrgMember, requireOrgPermission } from "@/lib/authz";
import {
  CreateAssigneeSchema,
  DeleteAssigneeSchema,
} from "@/lib/validators/assignee";
import {
  createAssignee,
  deleteAssignee,
  getAssignees,
} from "@/lib/services/assignees";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; taskInstanceId: string }> },
) {
  const { orgId, taskInstanceId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_TIMETABLE);
  if (!authz.ok) return authz.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateAssigneeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await createAssignee(
    orgId,
    taskInstanceId,
    parsed.data.membershipId,
  );
  if (!result.ok) {
    const status = result.code === "CONFLICT" ? 409 : 404;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result.data, { status: 201 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; taskInstanceId: string }> },
) {
  const { orgId, taskInstanceId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const assignees = await getAssignees(orgId, taskInstanceId);
  return NextResponse.json(assignees);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string; taskInstanceId: string }> },
) {
  const { orgId, taskInstanceId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_TIMETABLE);
  if (!authz.ok) return authz.response;

  const json = await req.json().catch(() => null);
  const parsed = DeleteAssigneeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await deleteAssignee(
    orgId,
    taskInstanceId,
    parsed.data.membershipId,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
