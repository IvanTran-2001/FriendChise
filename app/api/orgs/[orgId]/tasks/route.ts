import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrgPermission } from "@/lib/authz";
import { createTask, deleteTask, findTaskByName, setTaskEligibilities } from "@/lib/services/tasks";
import { PermissionAction } from "@prisma/client";
import { createTaskSchema } from "@/lib/validators/task";
import { removeTaskImage, saveTaskImagePath } from "@/app/actions/storage";
import { prisma } from "@/lib/platform/prisma";
import { createSignedReadUrl } from "@/lib/platform/supabase-storage";
import { parseRequestBody } from "@/lib/http/request-body";

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePayload(body: FormData | Record<string, unknown>) {
  if (body instanceof FormData) {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of body.entries()) {
      const existing = normalized[key];
      if (existing === undefined) {
        normalized[key] = value;
      } else if (Array.isArray(existing)) {
        normalized[key] = [...existing, value];
      } else {
        normalized[key] = [existing, value];
      }
    }
    return normalized;
  }

  return body;
}

function getStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (typeof value === "string") {
    return [value];
  }

  return [];
}

function extractPayload(body: FormData | Record<string, unknown>) {
  const normalized = normalizePayload(body);
  const minWaitDays = asNumber(normalized.minWaitDays);
  const maxWaitDays = asNumber(normalized.maxWaitDays);
  const bothEmpty = minWaitDays === undefined && maxWaitDays === undefined;

  return {
    color: asString(normalized.color) ?? "#6366f1",
    title: asString(normalized.title) ?? "",
    description: asString(normalized.description) || undefined,
    imageStoragePath: asString(normalized.imageStoragePath)?.trim() || undefined,
    durationMin: asNumber(normalized.durationMin),
    preferredStartTimeMin: asNumber(normalized.preferredStartTimeMin),
    peopleRequired: asNumber(normalized.peopleRequired) ?? 1,
    minWaitDays: bothEmpty ? 0 : minWaitDays,
    maxWaitDays: bothEmpty ? 0 : maxWaitDays,
    roleIds: getStringArray(normalized.roleIds),
  };
}

function normalizeImageStoragePath(orgId: string, imageStoragePath: string) {
  const normalized = imageStoragePath.replace(/^\/+/, "").replace(/\.\./g, "");
  return normalized.startsWith(`orgs/${orgId}/images/`) ? normalized : null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return authz.response;

  const body = await parseRequestBody(req, { multipart: true });
  if (body instanceof NextResponse) return body;

  const payload = extractPayload(body);
  let taskImagePath: string | null = null;

  const parsed = createTaskSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid task data",
        errors: parsed.error.flatten().fieldErrors,
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

  const normalizedImagePath = parsed.data.imageStoragePath
    ? normalizeImageStoragePath(orgId, parsed.data.imageStoragePath)
    : undefined;

  if (parsed.data.imageStoragePath) {
    if (!normalizedImagePath) {
      return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
    }

    const libraryImage = await prisma.orgImage.findFirst({
      where: { orgId, storagePath: normalizedImagePath },
      select: { id: true },
    });

    const storageImageExists = libraryImage
      ? true
      : await createSignedReadUrl(normalizedImagePath)
          .then((signedUrl) => Boolean(signedUrl))
          .catch(() => false);

    if (!storageImageExists) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
  }

  let createdTaskId: string | null = null;
  try {
    const taskInput = normalizedImagePath
      ? { ...parsed.data, imageStoragePath: normalizedImagePath }
      : parsed.data;
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
        throw new Error(imageResult.error);
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

    console.error("Failed to create task", error);

    return NextResponse.json({ error: "Failed to create task." }, { status: 500 });
  }
}