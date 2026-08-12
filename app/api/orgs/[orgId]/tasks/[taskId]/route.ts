import { NextResponse } from "next/server";
import { PermissionAction, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireOrgMember, requireOrgPermissionAction, requireParentOrgOwnerAction } from "@/lib/authz";
import { checkDemoLimit } from "@/lib/demo";
import { parseRequestBody } from "@/lib/http/request-body";
import { prisma } from "@/lib/platform/prisma";
import { createSignedReadUrl } from "@/lib/platform/supabase-storage";
import { getAccessibleTaskById, getTaskOwnerOrgId, setTaskEligibilities, setTaskToolLinks, updateTask } from "@/lib/services/tasks";
import { renameTaskImageIfNeeded } from "@/lib/services/images";
import { setTaskTags } from "@/lib/services/tags";
import { updateTaskSchema } from "@/lib/validators/task";

type UpdateTaskBody = {
  color: string;
  title: string;
  description?: string;
  durationMin: number;
  preferredStartTimeMin?: number;
  peopleRequired?: number;
  minWaitDays?: number;
  maxWaitDays?: number;
  tagIds?: string[];
  roleIds?: string[];
  toolPaths?: string[];
  toolLabels?: (string | null)[];
};

function normalizePayload(body: FormData | Record<string, unknown>) {
  if (body instanceof FormData) {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of body.entries()) {
      const existing = normalized[key];
      if (existing === undefined) {
        normalized[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        normalized[key] = [existing, value];
      }
    }
    return normalized;
  }

  return body;
}

function hasField(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asStringArray(value: unknown) {
  if (value === undefined) return undefined;
  if (value instanceof FormData) return undefined;
  if (Array.isArray(value)) {
    return value.every((entry) => typeof entry === "string") ? value : null;
  }
  if (typeof value === "string") {
    return [value];
  }
  return null;
}

function normalizeToolLabel(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseUpdateTaskBody(body: FormData | Record<string, unknown>): { ok: true; data: UpdateTaskBody } | { ok: false; response: NextResponse } {
  const normalized = normalizePayload(body);

  const title = asString(normalized.title) ?? "";
  const color = asString(normalized.color) ?? "#6366f1";
  const description = asString(normalized.description) || undefined;
  const durationMin = asNumber(normalized.durationMin);
  const preferredStartTimeMin = asNumber(normalized.preferredStartTimeMin);
  const peopleRequired = asNumber(normalized.peopleRequired) ?? 1;
  const minWaitDays = asNumber(normalized.minWaitDays);
  const maxWaitDays = asNumber(normalized.maxWaitDays);

  const tagIds = hasField(normalized, "tagIds") ? asStringArray(normalized.tagIds) : undefined;
  const roleIds = hasField(normalized, "roleIds") ? asStringArray(normalized.roleIds) : undefined;
  const toolPaths = hasField(normalized, "toolPaths") ? asStringArray(normalized.toolPaths) : undefined;
  const toolLabels = hasField(normalized, "toolLabels")
    ? asStringArray(normalized.toolLabels)?.map((label) => normalizeToolLabel(label))
    : undefined;

  if (tagIds === null || roleIds === null || toolPaths === null || toolLabels === null) {
    return { ok: false, response: NextResponse.json({ error: "Invalid task data." }, { status: 400 }) };
  }

  const parsed = updateTaskSchema.safeParse({
    color,
    title,
    description,
    durationMin,
    preferredStartTimeMin,
    peopleRequired,
    minWaitDays,
    maxWaitDays,
  });

  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Invalid task data",
          errors: z.flattenError(parsed.error).fieldErrors,
        },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    data: {
      ...parsed.data,
      tagIds,
      roleIds,
      toolPaths,
      toolLabels,
    },
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; taskId: string }> },
) {
  const { orgId, taskId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const accessible = await getAccessibleTaskById(orgId, taskId);
  if (!accessible) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const imageSignedUrl = accessible.task.imageUrl
    ? await createSignedReadUrl(accessible.task.imageUrl).catch(() => null)
    : null;

  return NextResponse.json({
    task: {
      ...accessible.task,
      imageSignedUrl,
      isOwner: accessible.isOwner,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string; taskId: string }> },
) {
  const { orgId, taskId } = await params;

  const taskOrgId = await getTaskOwnerOrgId(taskId);
  if (!taskOrgId) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const [franchiseAuthz, taskOrgAuthz] = await Promise.all([
    requireParentOrgOwnerAction(orgId),
    requireOrgPermissionAction(taskOrgId, PermissionAction.MANAGE_TASKS),
  ]);
  if (!franchiseAuthz.ok && !taskOrgAuthz.ok) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const authz = franchiseAuthz.ok ? franchiseAuthz : taskOrgAuthz;
  const demoCheck = await checkDemoLimit(authz.userEmail, "task", taskOrgId);
  if (!demoCheck.ok) {
    return NextResponse.json({ error: demoCheck.error }, { status: 429 });
  }

  const body = await parseRequestBody(req, { multipart: true });
  if (body instanceof NextResponse) return body;

  const parsed = parseUpdateTaskBody(body);
  if (!parsed.ok) return parsed.response;

  const task = await prisma.task.findFirst({
    where: { id: taskId, orgId: taskOrgId },
    select: { name: true },
  });
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  try {
    const result = await updateTask(
      taskOrgId,
      taskId,
      parsed.data,
      authz.userId,
      authz.userEmail,
    );
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }

      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    try {
      await renameTaskImageIfNeeded(taskOrgId, taskId);
    } catch (error) {
      console.error("Failed to rename task image after task update", error);
    }

    const tagIds = parsed.data.tagIds;
    if (tagIds !== undefined) {
      const validTags = await prisma.tag.findMany({
        where: { orgId: taskOrgId, id: { in: tagIds } },
        select: { id: true },
      });
      if (validTags.length !== new Set(tagIds).size) {
        return NextResponse.json({ error: "One or more tag IDs are invalid for this organization." }, { status: 400 });
      }
      await setTaskTags(taskOrgId, taskId, tagIds);
    }

    const roleIds = parsed.data.roleIds;
    if (roleIds !== undefined) {
      const validRoles = await prisma.role.findMany({
        where: { orgId: taskOrgId, id: { in: roleIds } },
        select: { id: true },
      });
      if (validRoles.length !== new Set(roleIds).size) {
        return NextResponse.json({ error: "One or more role IDs are invalid for this organization." }, { status: 400 });
      }
      await setTaskEligibilities(taskOrgId, taskId, roleIds);
    }

    const toolPaths = parsed.data.toolPaths;
    if (toolPaths !== undefined) {
      await setTaskToolLinks(
        taskOrgId,
        taskId,
        toolPaths.filter((path) => !path.startsWith("//")).map((toolPath, index) => ({
          toolPath,
          toolLabel: parsed.data.toolLabels?.[index] ?? null,
        })),
      );
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: `A task named "${parsed.data.title}" already exists.` }, { status: 409 });
    }

    console.error("Failed to update task", error);
    return NextResponse.json({ error: "Failed to update task." }, { status: 500 });
  }

  const accessible = await getAccessibleTaskById(orgId, taskId);
  if (!accessible) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const imageSignedUrl = accessible.task.imageUrl
    ? await createSignedReadUrl(accessible.task.imageUrl).catch(() => null)
    : null;

  return NextResponse.json({
    task: {
      ...accessible.task,
      imageSignedUrl,
      isOwner: accessible.isOwner,
    },
  });
}
