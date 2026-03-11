import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { statusSchema } from "@/lib/validators/task";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string; taskInstanceId: string }> },
) {
  const { orgId, taskInstanceId } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = statusSchema.safeParse(json);
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
