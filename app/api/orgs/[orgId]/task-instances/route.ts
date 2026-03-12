import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updateTaskInstanceStatusSchema } from "@/lib/validators/task";
import { requireOrgMember } from "@/lib/authz";

const createTaskInstanceSchema = z.object({
  taskId: z.string(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
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
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Task instance already exists" },
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
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const completedParam = url.searchParams.get("completed"); // "true" | "false" | null

  // Build filter
  const where: Record<string, unknown> = { orgId };

  if (statusParam && completedParam !== null) {
    return NextResponse.json(
      { error: "Use either 'status' or 'completed', not both" },
      { status: 400 },
    );
  }

  if (statusParam) {
    const parsed = updateTaskInstanceStatusSchema.safeParse({
      status: statusParam,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    where.status = parsed.data.status;
  } else if (completedParam === "false") {
    where.status = { notIn: ["DONE", "SKIPPED"] };
  } else if (completedParam === "true") {
    where.status = { in: ["DONE", "SKIPPED"] };
  } else if (completedParam !== null) {
    return NextResponse.json(
      { error: "'completed' must be 'true' or 'false'" },
      { status: 400 },
    );
  }

  const items = await prisma.taskInstance.findMany({
    where: where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items, { status: 200 });
}
