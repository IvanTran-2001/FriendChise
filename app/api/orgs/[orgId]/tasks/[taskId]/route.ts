import { NextResponse } from "next/server";
import { PermissionAction, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireOrgMember, requireOrgPermissionAction, requireParentOrgOwnerAction } from "@/lib/authz";
import { checkDemoLimit } from "@/lib/demo";
import { parseRequestBody } from "@/lib/http/request-body";
import { asNullableNumber, asNumber, asString, asStringArray, hasField, normalizePayload, normalizeToolLabel } from "@/lib/http/task-form";
import { prisma } from "@/lib/platform/prisma";
import { createSignedReadUrl } from "@/lib/platform/supabase-storage";
import { isSameFranchise } from "@/lib/services/franchise-root";
import { getAccessibleTaskById, getTaskOwnerOrgId, setTaskEligibilities, setTaskToolLinks, updateTask } from "@/lib/services/tasks";
import { renameTaskImageIfNeeded } from "@/lib/services/images";
import { setTaskTags } from "@/lib/services/tags";

type UpdateTaskBody = {
  title?: string;
  color?: string;
  description?: string | null;
  durationMin?: number;
  preferredStartTimeMin?: number | null;
  peopleRequired?: number;
  minWaitDays?: number | null;
  maxWaitDays?: number | null;
  tagIds?: string[];
  roleIds?: string[];
  toolPaths?: string[];
  toolLabels?: (string | null)[];
};

type FieldErrorResponse = {
  error: string;
  errors: Record<string, string[]>;
};

const updateTaskPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color").optional(),
  description: z.string().max(5000).nullable().optional(),
  durationMin: z.number().int().positive().max(24 * 60).optional(),
  preferredStartTimeMin: z.number().int().min(0).max(1439).nullable().optional(),
  peopleRequired: z.number().int().min(1).max(50).optional(),
  minWaitDays: z.number().int().min(0).max(3650).nullable().optional(),
  maxWaitDays: z.number().int().min(0).max(3650).nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  roleIds: z.array(z.string()).optional(),
  toolPaths: z.array(z.string()).optional(),
  toolLabels: z.array(z.string().nullable()).optional(),
}).superRefine((data, ctx) => {
  if (data.minWaitDays != null && data.maxWaitDays != null && data.minWaitDays > data.maxWaitDays) {
    ctx.addIssue({
      code: "custom",
      path: ["minWaitDays"],
      message: "minWaitDays cannot be greater than maxWaitDays",
    });
  }
});

function invalidFieldResponse(field: string, message: string): NextResponse<FieldErrorResponse> {
  return NextResponse.json(
    {
      error: "Invalid task data",
      errors: { [field]: [message] },
    },
    { status: 400 },
  );
}

function parseUpdateTaskBody(body: FormData | Record<string, unknown>): { ok: true; data: UpdateTaskBody } | { ok: false; response: NextResponse } {
  const normalized = normalizePayload(body);
  const data: UpdateTaskBody = {};
  let hasUpdateFields = false;

  if (hasField(normalized, "title")) {
    const title = asString(normalized.title);
    if (title == null) {
      return { ok: false, response: invalidFieldResponse("title", "Invalid task data.") };
    }
    data.title = title;
    hasUpdateFields = true;
  }

  if (hasField(normalized, "color")) {
    const color = asString(normalized.color);
    if (color == null) {
      return { ok: false, response: invalidFieldResponse("color", "Invalid task data.") };
    }
    data.color = color;
    hasUpdateFields = true;
  }

  if (hasField(normalized, "description")) {
    const description = normalized.description;
    if (description === null) {
      data.description = null;
    } else if (typeof description === "string") {
      data.description = description;
    } else {
      return { ok: false, response: invalidFieldResponse("description", "Invalid task data.") };
    }
    hasUpdateFields = true;
  }

  if (hasField(normalized, "durationMin")) {
    const durationMin = asNumber(normalized.durationMin);
    if (durationMin === undefined) {
      return { ok: false, response: invalidFieldResponse("durationMin", "Invalid task data.") };
    }
    data.durationMin = durationMin;
    hasUpdateFields = true;
  }

  if (hasField(normalized, "preferredStartTimeMin")) {
    const preferredStartTimeMin = asNullableNumber(normalized.preferredStartTimeMin);
    if (preferredStartTimeMin === undefined) {
      return { ok: false, response: invalidFieldResponse("preferredStartTimeMin", "Invalid task data.") };
    }
    data.preferredStartTimeMin = preferredStartTimeMin;
    hasUpdateFields = true;
  }

  if (hasField(normalized, "peopleRequired")) {
    const peopleRequired = asNumber(normalized.peopleRequired);
    if (peopleRequired === undefined) {
      return { ok: false, response: invalidFieldResponse("peopleRequired", "Invalid task data.") };
    }
    data.peopleRequired = peopleRequired;
    hasUpdateFields = true;
  }

  if (hasField(normalized, "minWaitDays")) {
    const minWaitDays = asNullableNumber(normalized.minWaitDays);
    if (minWaitDays === undefined) {
      return { ok: false, response: invalidFieldResponse("minWaitDays", "Invalid task data.") };
    }
    data.minWaitDays = minWaitDays;
    hasUpdateFields = true;
  }

  if (hasField(normalized, "maxWaitDays")) {
    const maxWaitDays = asNullableNumber(normalized.maxWaitDays);
    if (maxWaitDays === undefined) {
      return { ok: false, response: invalidFieldResponse("maxWaitDays", "Invalid task data.") };
    }
    data.maxWaitDays = maxWaitDays;
    hasUpdateFields = true;
  }

  if (hasField(normalized, "tagIds")) {
    const tagIds = asStringArray(normalized.tagIds);
    if (tagIds === undefined) {
      return { ok: false, response: invalidFieldResponse("tagIds", "Invalid task data.") };
    }
    data.tagIds = tagIds;
    hasUpdateFields = true;
  }

  if (hasField(normalized, "roleIds")) {
    const roleIds = asStringArray(normalized.roleIds);
    if (roleIds === undefined) {
      return { ok: false, response: invalidFieldResponse("roleIds", "Invalid task data.") };
    }
    data.roleIds = roleIds;
    hasUpdateFields = true;
  }

  if (hasField(normalized, "toolPaths")) {
    const toolPaths = asStringArray(normalized.toolPaths);
    if (toolPaths === undefined) {
      return { ok: false, response: invalidFieldResponse("toolPaths", "Invalid task data.") };
    }
    data.toolPaths = toolPaths;
    hasUpdateFields = true;
  }

  if (hasField(normalized, "toolLabels")) {
    const toolLabels = asStringArray(normalized.toolLabels);
    if (toolLabels === undefined) {
      return { ok: false, response: invalidFieldResponse("toolLabels", "Invalid task data.") };
    }
    data.toolLabels = toolLabels.map((label) => normalizeToolLabel(label));
    hasUpdateFields = true;
  }

  if (!hasUpdateFields) {
    return { ok: false, response: invalidFieldResponse("_", "Invalid task data.") };
  }

  const validation = updateTaskPatchSchema.safeParse(data);
  if (!validation.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid task data", errors: z.flattenError(validation.error).fieldErrors }, { status: 400 }),
    };
  }

  return { ok: true, data: validation.data };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; taskId: string }> },
) {
  const { orgId, taskId } = await params;

  const memberAuthz = await requireOrgMember(orgId);
  if (!memberAuthz.ok) return memberAuthz.response;

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

  const memberAuthz = await requireOrgMember(orgId);
  if (!memberAuthz.ok) return memberAuthz.response;

  const taskOrgId = await getTaskOwnerOrgId(taskId);
  if (!taskOrgId) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const [requestOrg, taskOrg] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, parentId: true } }),
    prisma.organization.findUnique({ where: { id: taskOrgId }, select: { id: true, parentId: true } }),
  ]);
  if (!requestOrg || !taskOrg || !isSameFranchise(requestOrg, taskOrg)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const [franchiseAuthz, taskOrgAuthz] = await Promise.all([
    requireParentOrgOwnerAction(orgId),
    requireOrgPermissionAction(taskOrgId, PermissionAction.MANAGE_TASKS),
  ]);
  if (!franchiseAuthz.ok && !taskOrgAuthz.ok) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const editAuthz = franchiseAuthz.ok
    ? franchiseAuthz
    : taskOrgAuthz.ok
      ? taskOrgAuthz
      : null;
  if (!editAuthz) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const demoCheck = await checkDemoLimit(editAuthz.userEmail, "task", taskOrgId);
  if (!demoCheck.ok) {
    return NextResponse.json({ error: demoCheck.error }, { status: 429 });
  }

  const body = await parseRequestBody(req, { multipart: true });
  if (body instanceof NextResponse) return body;

  const parsed = parseUpdateTaskBody(body);
  if (!parsed.ok) return parsed.response;

  const existingWaitDays = await prisma.task.findFirst({
    where: { id: taskId, orgId: taskOrgId },
    select: { minWaitDays: true, maxWaitDays: true },
  });
  if (!existingWaitDays) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const hasMinWaitDays = Object.prototype.hasOwnProperty.call(parsed.data, "minWaitDays");
  const hasMaxWaitDays = Object.prototype.hasOwnProperty.call(parsed.data, "maxWaitDays");
  const mergedMinWaitDays = hasMinWaitDays ? parsed.data.minWaitDays : existingWaitDays.minWaitDays;
  const mergedMaxWaitDays = hasMaxWaitDays ? parsed.data.maxWaitDays : existingWaitDays.maxWaitDays;
  if (mergedMinWaitDays != null && mergedMaxWaitDays != null && mergedMinWaitDays > mergedMaxWaitDays) {
    return NextResponse.json(
      { error: "Invalid task data", errors: { minWaitDays: ["minWaitDays cannot be greater than maxWaitDays"] } },
      { status: 400 },
    );
  }

  const { tagIds, roleIds, toolPaths, toolLabels, ...taskPatch } = parsed.data;

  if (tagIds !== undefined) {
    const validTags = await prisma.tag.findMany({
      where: { orgId: taskOrgId, id: { in: tagIds } },
      select: { id: true },
    });
    if (validTags.length !== new Set(tagIds).size) {
      return NextResponse.json({ error: "One or more tag IDs are invalid for this organization." }, { status: 400 });
    }
  }

  if (roleIds !== undefined) {
    const validRoles = await prisma.role.findMany({
      where: { orgId: taskOrgId, id: { in: roleIds } },
      select: { id: true },
    });
    if (validRoles.length !== new Set(roleIds).size) {
      return NextResponse.json({ error: "One or more role IDs are invalid for this organization." }, { status: 400 });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const taskUpdateResult = await updateTask(taskOrgId, taskId, taskPatch, editAuthz.userId, editAuthz.userEmail, tx);
      if (!taskUpdateResult.ok) {
        return taskUpdateResult;
      }

      if (tagIds !== undefined) {
        await setTaskTags(taskOrgId, taskId, tagIds, tx);
      }

      if (roleIds !== undefined) {
        await setTaskEligibilities(taskOrgId, taskId, roleIds, tx);
      }

      if (toolPaths !== undefined) {
        const filteredToolLinks = toolPaths
          .map((toolPath, index) => ({ toolPath, index }))
          .filter(({ toolPath }) => !toolPath.startsWith("//"))
          .map(({ toolPath, index }) => ({
            toolPath,
            toolLabel: toolLabels?.[index] ?? null,
          }));

        await setTaskToolLinks(taskOrgId, taskId, filteredToolLinks, tx);
      }

      return taskUpdateResult;
    });

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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A task with that name already exists." }, { status: 409 });
    }

    console.error("Failed to update task", error);
    return NextResponse.json({ error: "Failed to update task." }, { status: 500 });
  }

  const accessible = await getAccessibleTaskById(taskOrgId, taskId);
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
      isOwner: taskOrgId === orgId,
    },
  });
}
