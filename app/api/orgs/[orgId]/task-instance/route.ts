import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { statusSchema } from "@/lib/validators/task";

const createTaskInstanceSchema = z.object({
  taskId: z.string(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

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

  const { taskId } = parsed.data;

  const task = await prisma.task.findFirst({
    where: { id: taskId, orgId },
    select: { id: true },
  });

  if (!task) {
    return NextResponse.json(
      { error: "Invalid taskId: not found or does not belong to this org" },
      { status: 400 },
    );
  }

  try {
    const taskInstance = await prisma.taskInstance.create({
      data: { orgId, taskId },
    });
    return NextResponse.json(taskInstance, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: "Task instance already exists (or invalid taskId)",
        detail: String((e as Error)?.message ?? e),
      },
      { status: 409 },
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const completedParam = url.searchParams.get("completed"); // "true" | "false" | null

  // Build filter
  const where: Record<string, unknown> = { orgId };

  // If you pass status=..., validate it
  if (statusParam) {
    const parsed = statusSchema.safeParse({ status: statusParam });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    where.status = parsed.data.status;
  }

  // If completed=false, exclude completed statuses
  // (adjust list if you treat SKIPPED as completed too)
  if (completedParam === "false") {
    where.status = { notIn: ["DONE"] };
  }

  const items = await prisma.taskInstance.findMany({
    where: where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items, { status: 200 });
}
