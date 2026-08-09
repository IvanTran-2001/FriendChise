import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrgPermission } from "@/lib/authz";
import { createTask, findTaskByName, setTaskEligibilities } from "@/lib/services/tasks";
import { PermissionAction } from "@prisma/client";
import { createTaskSchema } from "@/lib/validators/task";
import { saveTaskImagePath } from "@/app/actions/storage";

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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return authz.response;

  const contentType = req.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? extractPayload((await req.json().catch(() => null)) as Record<string, unknown> | null ?? {})
    : extractPayload(await req.formData());

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

  try {
    const task = await createTask(
      orgId,
      parsed.data,
      authz.userId,
      authz.userEmail,
      null,
    );

    if (parsed.data.imageStoragePath) {
      const imageResult = await saveTaskImagePath(orgId, task.id, parsed.data.imageStoragePath);
      if (!imageResult.ok) {
        throw new Error(imageResult.error);
      }
    }

    if (payload.roleIds.length > 0) {
      await setTaskEligibilities(orgId, task.id, payload.roleIds);
    }

    return NextResponse.json({ taskId: task.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: `A task named "${parsed.data.title}" already exists.` },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create task." },
      { status: 500 },
    );
  }
}