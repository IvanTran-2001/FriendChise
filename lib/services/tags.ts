import { log } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit-log";
import type { ServiceResult } from "./types";

// ─── Tag CRUD ─────────────────────────────────────────────────────────────────

/**
 * Returns all tags for the given org, ordered alphabetically.
 * Default tags are returned first.
 */
export async function getOrgTags(orgId: string) {
  return prisma.tag.findMany({
    where: { orgId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: { _count: { select: { tasks: true } } },
  });
}

/**
 * Creates a new tag scoped to the org.
 * Returns CONFLICT if a tag with the same name already exists in this org.
 */
export async function createTag(
  orgId: string,
  data: { name: string; color?: string },
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<{ id: string; name: string; color: string; isDefault: boolean }>> {
  let tag;
  try {
    tag = await prisma.tag.create({
      data: {
        orgId,
        name: data.name,
        color: data.color ?? "#6B7280",
      },
    });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return { ok: false, error: "A tag with that name already exists.", code: "CONFLICT" };
    }
    throw e;
  }

  log.info("Tag created", { orgId, tagId: tag.id });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "tag.create",
    targetType: "Tag",
    targetId: tag.id,
    after: { name: tag.name, color: tag.color },
  });

  return { ok: true, data: tag };
}

/**
 * Deletes a tag by id, scoped to `orgId`.
 * Returns NOT_FOUND if no matching record exists.
 * Returns INVALID if the tag is a default (protected) tag.
 */
export async function deleteTag(
  orgId: string,
  tagId: string,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<null>> {
  const existing = await prisma.tag.findFirst({
    where: { id: tagId, orgId },
  });
  if (!existing) return { ok: false, error: "Tag not found.", code: "NOT_FOUND" };
  if (existing.isDefault) return { ok: false, error: "Default tags cannot be deleted.", code: "INVALID" };

  await prisma.tag.delete({ where: { id: tagId } });

  log.info("Tag deleted", { orgId, tagId });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "tag.delete",
    targetType: "Tag",
    targetId: tagId,
    before: { name: existing.name, color: existing.color },
  });

  return { ok: true, data: null };
}

/**
 * Updates name and/or color on a tag scoped to `orgId`.
 * Default tags cannot have their name changed.
 * Returns CONFLICT if the new name is already taken by another tag in this org.
 */
export async function updateTag(
  orgId: string,
  tagId: string,
  data: { name?: string; color?: string },
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<{ id: string; name: string; color: string; isDefault: boolean }>> {
  const existing = await prisma.tag.findFirst({ where: { id: tagId, orgId } });
  if (!existing) return { ok: false, error: "Tag not found.", code: "NOT_FOUND" };

  if (data.name && data.name !== existing.name) {
    if (existing.isDefault)
      return { ok: false, error: "Cannot rename a default tag.", code: "INVALID" };
    const conflict = await prisma.tag.findUnique({
      where: { orgId_name: { orgId, name: data.name } },
    });
    if (conflict) return { ok: false, error: "A tag with that name already exists.", code: "CONFLICT" };
  }

  let tag;
  try {
    tag = await prisma.tag.update({
      where: { id: tagId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.color ? { color: data.color } : {}),
      },
    });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return { ok: false, error: "A tag with that name already exists.", code: "CONFLICT" };
    }
    throw e;
  }

  log.info("Tag updated", { orgId, tagId });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "tag.update",
    targetType: "Tag",
    targetId: tagId,
    before: { name: existing.name, color: existing.color },
    after: { name: tag.name, color: tag.color },
  });

  return { ok: true, data: tag };
}

// ─── Task ↔ Tag ─────────────────────────────────────────────────────────────────

/**
 * Attaches a tag to a task. Both must belong to `orgId`.
 * No-ops gracefully if the tag is already attached.
 */
export async function addTagToTask(
  orgId: string,
  taskId: string,
  tagId: string,
): Promise<ServiceResult<null>> {
  const [task, tag] = await Promise.all([
    prisma.task.findFirst({ where: { id: taskId, orgId }, select: { id: true } }),
    prisma.tag.findFirst({ where: { id: tagId, orgId }, select: { id: true } }),
  ]);
  if (!task) return { ok: false, error: "Task not found.", code: "NOT_FOUND" };
  if (!tag) return { ok: false, error: "Tag not found.", code: "NOT_FOUND" };

  await prisma.taskTag.upsert({
    where: { taskId_tagId: { taskId, tagId } },
    create: { taskId, tagId },
    update: {},
  });

  return { ok: true, data: null };
}

/**
 * Removes a tag from a task. Both must belong to `orgId`.
 * Returns NOT_FOUND if the task or tag don't belong to this org.
 */
export async function removeTagFromTask(
  orgId: string,
  taskId: string,
  tagId: string,
): Promise<ServiceResult<null>> {
  const [task, tag] = await Promise.all([
    prisma.task.findFirst({ where: { id: taskId, orgId }, select: { id: true } }),
    prisma.tag.findFirst({ where: { id: tagId, orgId }, select: { id: true } }),
  ]);
  if (!task) return { ok: false, error: "Task not found.", code: "NOT_FOUND" };
  if (!tag) return { ok: false, error: "Tag not found.", code: "NOT_FOUND" };

  await prisma.taskTag.deleteMany({ where: { taskId, tagId } });

  return { ok: true, data: null };
}

/**
 * Bulk-sets the tags on a task, replacing any existing tags.
 * Used on task creation where all tags are submitted together.
 * Tag ids that don't belong to `orgId` are silently ignored.
 */
export async function setTaskTags(
  orgId: string,
  taskId: string,
  tagIds: string[],
): Promise<void> {
  // Verify all tagIds belong to this org
  const validTags = await prisma.tag.findMany({
    where: { id: { in: tagIds }, orgId },
    select: { id: true },
  });
  const validIds = validTags.map((t) => t.id);

  await prisma.$transaction([
    prisma.taskTag.deleteMany({ where: { taskId } }),
    prisma.taskTag.createMany({
      data: validIds.map((tagId) => ({ taskId, tagId })),
      skipDuplicates: true,
    }),
  ]);
}
