import { NextResponse } from "next/server";
import { OrgPermission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updateTaskInstanceStatusSchema } from "@/lib/validators/task";
import { requireOrgPermission } from "@/lib/authz";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string; taskInstanceId: string }> },
) {
  const { orgId, taskInstanceId } = await params;

  const authz = await requireOrgPermission(
    orgId,
    OrgPermission.TASKINSTANCE_COMPLETE,
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

  const { status } = parsed.data;

  const updated = await prisma.taskInstance.updateMany({
    where: { id: taskInstanceId, orgId },
    data: { status },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Task instance not found in this org" },
      { status: 404 },
    );
  }

  // If you want to return the updated row, fetch it:
  const taskInstance = await prisma.taskInstance.findUnique({
    where: { id: taskInstanceId },
  });

  return NextResponse.json(taskInstance, { status: 200 });
}
