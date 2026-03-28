/**
 * REST endpoint: /api/orgs/[orgId]/task-instances
 *
 * GET  — List task instances. Any org member may call this.
 *         Optional query params (mutually exclusive):
 *           ?status=PENDING|IN_PROGRESS|DONE|SKIPPED  — exact status match
 *           ?completed=true|false                      — completed vs active
 * POST — Create a new task instance from an existing task.
 *         Requires MANAGE_TASKS permission.
 */
import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { updateTaskInstanceStatusSchema } from "@/lib/validators/task";
import { requireOrgMember, requireOrgPermission } from "@/lib/authz";
import { createTaskInstanceSchema } from "@/lib/validators/task-instance";
import {
  createTaskInstance,
  getTaskInstances,
  type GetTaskInstancesOptions,
} from "@/lib/services/task-instances";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return authz.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createTaskInstanceSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await createTaskInstance(orgId, parsed.data);
  if (!result.ok) {
    const status = result.code === "CONFLICT" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result.data, { status: 201 });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const completedParam = url.searchParams.get("completed");

  if (statusParam && completedParam !== null) {
    return NextResponse.json(
      { error: "Use either 'status' or 'completed', not both" },
      { status: 400 },
    );
  }

  const options: GetTaskInstancesOptions = {};

  if (statusParam) {
    const parsedStatus = updateTaskInstanceStatusSchema.safeParse({
      status: statusParam,
    });
    if (!parsedStatus.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsedStatus.error.issues },
        { status: 400 },
      );
    }
    options.status = parsedStatus.data.status;
  } else if (completedParam === "false") {
    options.completed = false;
  } else if (completedParam === "true") {
    options.completed = true;
  } else if (completedParam !== null) {
    return NextResponse.json(
      { error: "'completed' must be 'true' or 'false'" },
      { status: 400 },
    );
  }

  const items = await getTaskInstances(orgId, options);
  return NextResponse.json(items, { status: 200 });
}
