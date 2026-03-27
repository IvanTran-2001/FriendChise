import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { updateTaskInstanceStatusSchema } from "@/lib/validators/task";
import { requireOrgPermission } from "@/lib/authz";
import { updateTaskInstanceStatus } from "@/lib/services/task-instances";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string; taskInstanceId: string }> },
) {
  const { orgId, taskInstanceId } = await params;

  const authz = await requireOrgPermission(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return authz.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateTaskInstanceStatusSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await updateTaskInstanceStatus(
    orgId,
    taskInstanceId,
    parsed.data.status,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json(result.data, { status: 200 });
}
