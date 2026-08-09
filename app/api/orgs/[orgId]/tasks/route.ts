import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrgPermission } from "@/lib/authz";
import { createTask, deleteTask, findTaskByName, setTaskEligibilities } from "@/lib/services/tasks";
import { PermissionAction } from "@prisma/client";
import { createTaskSchema } from "@/lib/validators/task";
import { saveTaskImagePath } from "@/app/actions/storage";
import { prisma } from "@/lib/platform/prisma";
import { createSignedReadUrl } from "@/lib/platform/supabase-storage";

function asString(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: FormDataEntryValue | null | undefined) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractPayload(body: FormData | Record<string, unknown>) {
  if (body instanceof FormData) {
    const minWaitDays = asNumber(body.get("minWaitDays"));
    const maxWaitDays = asNumber(body.get("maxWaitDays"));
    const bothEmpty = minWaitDays === undefined && maxWaitDays === undefined;

    return {
      color: asString(body.get("color")) ?? "#6366f1",
      title: asString(body.get("title")) ?? "",
      description: asString(body.get("description")) || undefined,
      imageStoragePath: asString(body.get("imageStoragePath")) || undefined,
      durationMin: asNumber(body.get("durationMin")),
      preferredStartTimeMin: asNumber(body.get("preferredStartTimeMin")),
      peopleRequired: asNumber(body.get("peopleRequired")) ?? 1,
      minWaitDays: bothEmpty ? 0 : minWaitDays,
      maxWaitDays: bothEmpty ? 0 : maxWaitDays,
      roleIds: body
        .getAll("roleIds")
        .filter((value): value is string => typeof value === "string"),
    };
  }

  const minWaitDays = typeof body.minWaitDays === "number" ? body.minWaitDays : undefined;
  const maxWaitDays = typeof body.maxWaitDays === "number" ? body.maxWaitDays : undefined;
  const bothEmpty = minWaitDays === undefined && maxWaitDays === undefined;

  return {
    color: typeof body.color === "string" ? body.color : "#6366f1",
    title: typeof body.title === "string" ? body.title : "",
    description: typeof body.description === "string" ? body.description || undefined : undefined,
    imageStoragePath:
      typeof body.imageStoragePath === "string" && body.imageStoragePath.trim()
        ? body.imageStoragePath.trim()
        : undefined,
    durationMin: typeof body.durationMin === "number" ? body.durationMin : undefined,
    preferredStartTimeMin:
      typeof body.preferredStartTimeMin === "number" ? body.preferredStartTimeMin : undefined,
    peopleRequired: typeof body.peopleRequired === "number" ? body.peopleRequired : 1,
    minWaitDays: bothEmpty ? 0 : minWaitDays,
    maxWaitDays: bothEmpty ? 0 : maxWaitDays,
    roleIds: Array.isArray(body.roleIds)
      ? body.roleIds.filter((value): value is string => typeof value === "string")
      : [],
  };
}

async function parseRequestBody(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const isForm =
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded");

  if (!isJson && !isForm) {
    return NextResponse.json({ error: "Unsupported media type." }, { status: 415 });
  }

  if (isJson) {
    try {
      return ((await req.json()) as Record<string, unknown> | null) ?? {};
    } catch {
      return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
    }
  }

  try {
    return await req.formData();
  } catch {
    return NextResponse.json({ error: "Malformed form body." }, { status: 400 });
  }
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

  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;

  const payload = extractPayload(body);

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

  if (parsed.data.imageStoragePath) {
    const normalizedImagePath = normalizeImageStoragePath(orgId, parsed.data.imageStoragePath);
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

    parsed.data.imageStoragePath = normalizedImagePath;
  }

  let createdTaskId: string | null = null;
  try {
    const task = await createTask(
      orgId,
      parsed.data,
      authz.userId,
      authz.userEmail,
      null,
    );
    createdTaskId = task.id;

    if (parsed.data.imageStoragePath) {
      const imageResult = await saveTaskImagePath(orgId, task.id, parsed.data.imageStoragePath);
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
      try {
        await deleteTask(orgId, createdTaskId, authz.userId, authz.userEmail);
      } catch (cleanupError) {
        console.error("Failed to clean up created task after create failure", cleanupError);
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