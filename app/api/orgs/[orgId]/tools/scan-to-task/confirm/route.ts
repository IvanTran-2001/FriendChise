import { NextResponse } from "next/server";
import { PermissionAction, Prisma } from "@prisma/client";
import { requireOrgPermission } from "@/lib/authz";
import { checkDemoLimit } from "@/lib/demo";
import { parseRequestBody } from "@/lib/http/request-body";
import { log } from "@/lib/platform/observability";
import { prisma } from "@/lib/platform/prisma";
import { recordAudit } from "@/lib/services/audit-log";
import { colorFromSeed } from "@/lib/services/scan-to-task";
import { createTaskOnClient, findTaskByName } from "@/lib/services/tasks";
import { confirmScanToTaskSchema } from "@/lib/validators/scan-to-task";

const CONFIRMATION_UNAVAILABLE_ERROR = "Scan result is no longer available.";

function isTaskNameUniqueConstraint(error: Prisma.PrismaClientKnownRequestError) {
  const target = error.meta?.target;
  return (
    error.code === "P2002" &&
    (target === "Task_orgId_name_key" ||
      target === "Task_orgId_name_ci_key" ||
      (Array.isArray(target) && target.includes("orgId") && target.includes("name")))
  );
}

/**
 * Mobile-facing Scan to Task confirm endpoint.
 *
 * Confirms one reviewed draft and creates the real task record, mirroring
 * `confirmScanToTaskAction` on the web app.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return authz.response;

  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;

  const parsed = confirmScanToTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Fix the task details before confirming." }, { status: 400 });
  }

  const demoCheck = await checkDemoLimit(authz.userEmail, "task", orgId);
  if (!demoCheck.ok) {
    return NextResponse.json({ error: demoCheck.error }, { status: 429 });
  }

  const duplicateTask = await findTaskByName(orgId, parsed.data.title);
  if (duplicateTask) {
    return NextResponse.json({ error: `A task named "${duplicateTask.name}" already exists.` }, { status: 409 });
  }

  const creator = await prisma.user.findUnique({ where: { id: authz.userId }, select: { name: true } });
  const confirmedAt = new Date();

  try {
    const task = await prisma.$transaction(async (tx) => {
      const claimed = await tx.scanTaskResult.updateMany({
        where: {
          id: parsed.data.resultId,
          orgId,
          clearedAt: null,
          confirmedAt: null,
          taskId: null,
        },
        data: { confirmedAt, clearedAt: confirmedAt },
      });

      if (claimed.count === 0) {
        throw new Error(CONFIRMATION_UNAVAILABLE_ERROR);
      }

      const createdTask = await createTaskOnClient(
        tx,
        orgId,
        {
          color: parsed.data.color?.trim()
            ? parsed.data.color
            : colorFromSeed(`${parsed.data.fileName}:${parsed.data.title}`),
          title: parsed.data.title,
          description: [parsed.data.description, `Source file: ${parsed.data.fileName}`].filter(Boolean).join("\n\n"),
          durationMin: parsed.data.durationMin,
          peopleRequired: parsed.data.peopleRequired,
          minWaitDays: parsed.data.minWaitDays,
          maxWaitDays: parsed.data.maxWaitDays,
        },
        authz.userId,
        authz.userEmail,
        creator?.name ?? null,
      );

      await tx.scanTaskResult.update({
        where: { id: parsed.data.resultId },
        data: { taskId: createdTask.id },
      });

      return createdTask;
    });

    try {
      await recordAudit({
        orgId,
        actorId: authz.userId,
        actorEmail: authz.userEmail ?? null,
        action: "task.create",
        targetType: "Task",
        targetId: task.id,
        after: {
          name: task.name,
          color: task.color,
          description: task.description,
          durationMin: task.durationMin,
        },
      });
    } catch (error) {
      log.error("Failed to record scan-to-task audit log", { orgId, taskId: task.id, error });
    }

    return NextResponse.json({ taskId: task.id, resultId: parsed.data.resultId }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === CONFIRMATION_UNAVAILABLE_ERROR) {
      return NextResponse.json({ error: CONFIRMATION_UNAVAILABLE_ERROR }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && isTaskNameUniqueConstraint(error)) {
      return NextResponse.json({ error: `A task named "${parsed.data.title}" already exists.` }, { status: 409 });
    }

    log.error("Unexpected error confirming scan draft", { orgId, error });
    return NextResponse.json({ error: "Failed to confirm draft." }, { status: 500 });
  }
}
