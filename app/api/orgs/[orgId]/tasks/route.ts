import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/authz";
import { checkDemoLimit } from "@/lib/demo";
import { createTask, deleteTask, findTaskByName, setTaskEligibilities } from "@/lib/services/tasks";
import { PermissionAction } from "@prisma/client";
import { createTaskSchema } from "@/lib/validators/task";
import { removeTaskImage, saveTaskImagePath } from "@/app/actions/storage";
import { prisma } from "@/lib/platform/prisma";
import { parseRequestBody } from "@/lib/http/request-body";
import { asNumber, asString, asStringArray, hasField, normalizePayload } from "@/lib/http/task-form";

function extractPayload(body: FormData | Record<string, unknown>) {
  const normalized = normalizePayload(body);

  const minWaitDays = hasField(normalized, "minWaitDays") ? asNumber(normalized.minWaitDays) : 0;
  const maxWaitDays = hasField(normalized, "maxWaitDays") ? asNumber(normalized.maxWaitDays) : 0;
  const roleIds = hasField(normalized, "roleIds") ? asStringArray(normalized.roleIds) : [];

  if (hasField(normalized, "minWaitDays") && minWaitDays === undefined) {
    return { error: "One or more values are invalid.", roleIds: null } as const;
  }
  if (hasField(normalized, "maxWaitDays") && maxWaitDays === undefined) {
    return { error: "One or more values are invalid.", roleIds: null } as const;
  }
  if (hasField(normalized, "roleIds") && roleIds === undefined) {
    return { error: "One or more role IDs are invalid for this organization.", roleIds: null } as const;
  }

  return {
    color: asString(normalized.color) ?? "#6366f1",
    title: asString(normalized.title) ?? "",
    description: asString(normalized.description) || undefined,
    imageStoragePath: asString(normalized.imageStoragePath)?.trim() || undefined,
    durationMin: asNumber(normalized.durationMin),
    preferredStartTimeMin: asNumber(normalized.preferredStartTimeMin),
    peopleRequired: asNumber(normalized.peopleRequired) ?? 1,
    minWaitDays,
    maxWaitDays,
    roleIds: roleIds ?? [],
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return authz.response;

  const demoCheck = await checkDemoLimit(authz.userEmail, "task", orgId);
  if (!demoCheck.ok) {
    return NextResponse.json({ error: demoCheck.error }, { status: 429 });
  }

  const body = await parseRequestBody(req, { multipart: true });
  if (body instanceof NextResponse) return body;

  const payload = extractPayload(body);
  if ("error" in payload) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }
  let taskImagePath: string | null = null;

  const parsed = createTaskSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid task data",
        errors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const duplicateTask = await findTaskByName(orgId, parsed.data.title);
  if (duplicateTask) {
    return NextResponse.json(
      { error: `A task named "${duplicateTask.name}" already exists.` },
      { status: 409 },
    );
  }

  const requestedRoleIds = [...new Set(payload.roleIds)];
  if (requestedRoleIds.length > 0) {
    const validRoles = await prisma.role.findMany({
      where: { orgId, id: { in: requestedRoleIds } },
      select: { id: true },
    });

    if (validRoles.length !== requestedRoleIds.length) {
      return NextResponse.json(
        { error: "One or more role IDs are invalid for this organization." },
        { status: 400 },
      );
    }
  }

  let createdTaskId: string | null = null;
  try {
    const taskInput = parsed.data;
    taskImagePath = taskInput.imageStoragePath ?? null;

    const task = await createTask(
      orgId,
      taskInput,
      authz.userId,
      authz.userEmail,
      null,
    );
    createdTaskId = task.id;

    if (taskInput.imageStoragePath) {
      const imageResult = await saveTaskImagePath(orgId, task.id, taskInput.imageStoragePath);
      if (!imageResult.ok) {
        throw Object.assign(new Error(imageResult.error), { code: imageResult.code });
      }
    }

    if (requestedRoleIds.length > 0) {
      await setTaskEligibilities(orgId, task.id, requestedRoleIds);
    }

    return NextResponse.json({ taskId: task.id }, { status: 201 });
  } catch (error) {
    if (createdTaskId) {
      if (taskImagePath) {
        try {
          await removeTaskImage(orgId, createdTaskId);
        } catch (cleanupError) {
          console.error("Failed to clean up task image after create failure", cleanupError);
        }
      }

      try {
        await deleteTask(orgId, createdTaskId, authz.userId, authz.userEmail);
      } catch (cleanupError) {
        console.error("Failed to delete created task after create failure", cleanupError);
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: `A task named "${parsed.data.title}" already exists.` },
        { status: 409 },
      );
    }

    if (error && typeof error === "object" && "code" in error) {
      const code = (error as { code?: unknown }).code;
      if (code === "unauthorized") {
        return NextResponse.json({ error: (error as { message?: string }).message ?? "Unauthorized" }, { status: 403 });
      }
      if (code === "not_found") {
        return NextResponse.json({ error: (error as { message?: string }).message ?? "Image not found" }, { status: 404 });
      }
      if (code === "invalid_input") {
        return NextResponse.json({ error: (error as { message?: string }).message ?? "Invalid storage path" }, { status: 400 });
      }
    }

    console.error("Failed to create task", error);

    return NextResponse.json({ error: "Failed to create task." }, { status: 500 });
  }
}