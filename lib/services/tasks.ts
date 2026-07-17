/**
 * Task service — CRUD, accessibility, and franchise scope helpers.
 *
 * Key concepts
 * ────────────
 * Ownership vs. access: a task is owned by the org that created it (`task.orgId`).
 * Any org can also access a task they don't own via a `TaskInheritance` row.
 * `getAccessibleTaskById` returns `{ task, isOwner }` to distinguish the two cases.
 *
 * Inheritance flow:
 *  1. Owning org publishes task (scope → GLOBAL).
 *  2. Franchisee discovers it in the Shared view (`getSharedTasks`).
 *  3. Franchisee clicks Add → `inheritTask` creates a TaskInheritance row and
 *     copies the parent's section layout via `copySectionLayout`.
 *  4. Owning org can make private again (`unpublishTask`), optionally deleting
 *     child inheritance rows.
 *
 * Section layouts are seeded on task creation (`createDefaultSectionLayouts`)
 * and copied to franchisee orgs on inheritance.
 */
import { Prisma, TaskScope } from "@prisma/client";
import { log } from "@/lib/platform/observability";
import { prisma } from "@/lib/platform/prisma";
import { recordAudit } from "@/lib/services/audit-log";
import {
  copySectionLayout,
  DEFAULT_SECTIONS,
} from "@/lib/services/task-sections";
import type { ServiceResult } from "./types";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validators/task";

export type TaskToolLinkInput = {
  toolPath: string;
  toolLabel?: string | null;
};

/**
 * Creates a new task for the given org using validated input.
 * Optional fields are null-coalesced so callers never need to handle `undefined`.
 */
export async function createTask(
  orgId: string,
  data: CreateTaskInput,
  actorId?: string | null,
  actorEmail?: string | null,
  actorName?: string | null,
) {
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        orgId,
        name: data.title,
        color: data.color,
        description: data.description ?? null,
        durationMin: data.durationMin,
        preferredStartTimeMin: data.preferredStartTimeMin ?? null,
        minPeople: data.peopleRequired ?? 1,
        minWaitDays: data.minWaitDays ?? null,
        maxWaitDays: data.maxWaitDays ?? null,
        createdById: actorId ?? null,
        createdByName: actorName ?? null,
      },
    });

    await tx.taskSectionLayout.createMany({
      data: DEFAULT_SECTIONS.map((section) => ({
        taskId: created.id,
        orgId,
        ...section,
      })),
      skipDuplicates: true,
    });

    await tx.taskInheritance.create({
      data: { taskId: created.id, orgId },
    });

    return created;
  });

  log.info("Task created", { orgId, taskId: task.id });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
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
  return task;
}

/**
 * Replaces all tool links for a task with the provided set.
 * Intended for create/edit flows that submit the current selection in full.
 * Atomic: wrapped in a transaction so the delete is rolled back if the insert fails.
 */
export async function setTaskToolLinks(
  orgId: string,
  taskId: string,
  tools: TaskToolLinkInput[],
) {
  await prisma.$transaction(async (tx) => {
    await tx.taskToolLink.deleteMany({ where: { orgId, taskId } });
    await tx.taskToolLink.createMany({
      data: tools.map((tool) => ({
        orgId,
        taskId,
        toolPath: tool.toolPath,
        toolLabel: tool.toolLabel ?? null,
      })),
      skipDuplicates: true,
    });
  });
}

/**
 * Returns the orgId of the org that owns the task, or null if the task
 * doesn't exist. Used by actions to resolve cross-org edit/delete permissions.
 */
export async function getTaskOwnerOrgId(
  taskId: string,
): Promise<string | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { orgId: true },
  });
  return task?.orgId ?? null;
}

/**
 * Deletes a task by id, scoped to `orgId` to prevent cross-org deletion.
 * Returns a NOT_FOUND error if no matching record exists.
 */
export async function deleteTask(
  orgId: string,
  id: string,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<null>> {
  const existing = await prisma.task.findFirst({
    where: { id, orgId },
    select: { name: true, color: true, description: true, durationMin: true },
  });
  const { count } = await prisma.task.deleteMany({ where: { id, orgId } });
  if (count === 0)
    return { ok: false, error: "Task not found", code: "NOT_FOUND" };
  log.info("Task deleted", { orgId, taskId: id });
  if (existing) {
    recordAudit({
      orgId,
      actorId: actorId ?? null,
      actorEmail: actorEmail ?? null,
      action: "task.delete",
      targetType: "Task",
      targetId: id,
      before: {
        name: existing.name,
        color: existing.color,
        description: existing.description,
        durationMin: existing.durationMin,
      },
    });
  }
  return { ok: true, data: null };
}

const taskInclude = {
  organization: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, image: true } },
  eligibility: {
    select: {
      role: { select: { id: true, name: true, color: true } },
    },
  },
  tags: {
    select: {
      tag: { select: { id: true, name: true, color: true } },
    },
  },
  taskToolLinks: {
    select: {
      toolPath: true,
      toolLabel: true,
    },
  },
  comments: {
    where: { parentId: null, isPinned: true },
    orderBy: [{ pinnedAt: "desc" as const }, { createdAt: "asc" as const }],
    take: 3,
    select: {
      id: true,
      content: true,
      authorName: true,
      authorImage: true,
      createdAt: true,
      pinnedAt: true,
    },
  },
  _count: { select: { inheritedBy: true } },
} as const;

/**
 * Returns all tasks accessible to the org via TaskInheritance.
 * Includes tasks the org created (auto-inherited) and tasks inherited from others.
 */
export async function getInheritedTasks(orgId: string) {
  const inheritances = await prisma.taskInheritance.findMany({
    where: { orgId },
    include: { task: { include: taskInclude } },
    orderBy: { inheritedAt: "desc" },
  });
  return inheritances.map((i) => i.task);
}

/**
 * Returns GLOBAL-scoped tasks from the same franchise that this org hasn't
 * inherited yet. Covers tasks from the parent org and sibling orgs.
 */
export async function getSharedTasks(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { parentId: true },
  });
  if (!org) return [];

  const alreadyInherited = await prisma.taskInheritance
    .findMany({ where: { orgId }, select: { taskId: true } })
    .then((rows) => rows.map((r) => r.taskId));

  const franchiseParentId = org.parentId;

  return prisma.task.findMany({
    where: {
      scope: TaskScope.GLOBAL,
      orgId: { not: orgId },
      ...(alreadyInherited.length > 0 && { id: { notIn: alreadyInherited } }),
      OR: franchiseParentId
        ? [
            { orgId: franchiseParentId },
            { organization: { parentId: franchiseParentId } },
          ]
        : [{ organization: { parentId: orgId } }],
    },
    include: taskInclude,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Returns all tasks for the given org, sorted newest-first.
 * Includes role eligibility data for display in the task table.
 */
export async function getTasks(orgId: string) {
  const pageSize = 100;
  const totalCount = await prisma.task.count({ where: { orgId } });
  if (totalCount === 0) return [];

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const tasks = [] as Awaited<ReturnType<typeof prisma.task.findMany>>;

  for (let page = 1; page <= totalPages; page += 1) {
    const rows = await prisma.task.findMany({
      where: { orgId },
      include: taskInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    tasks.push(...rows);
  }

  return tasks;
}

export type TaskSortOption =
  | "name-asc"
  | "name-desc"
  | "duration-asc"
  | "duration-desc"
  | "people-asc"
  | "people-desc";

export type TasksPage = {
  tasks: (Awaited<ReturnType<typeof getInheritedTasks>>[number] & { _available: boolean })[];
  nextCursor: string | null;
};

type TaskPageFilters = {
  search?: string;
  roleId?: string;
  tagId?: string;
};

function buildTaskWhere(filters: TaskPageFilters): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {};

  if (filters.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }
  if (filters.roleId) {
    where.eligibility = { some: { roleId: filters.roleId } };
  }
  if (filters.tagId) {
    where.tags = { some: { tagId: filters.tagId } };
  }

  return where;
}

function sortOrderBy(sort: TaskSortOption) {
  switch (sort) {
    case "name-asc":    return { name: "asc" as const };
    case "name-desc":   return { name: "desc" as const };
    case "duration-asc":  return { durationMin: "asc" as const };
    case "duration-desc": return { durationMin: "desc" as const };
    case "people-asc":  return { minPeople: "asc" as const };
    case "people-desc": return { minPeople: "desc" as const };
  }
}

/**
 * Paginated task fetch for the tasks list page.
 * mode "list"      → inherited tasks only
 * mode "available" → GLOBAL franchise tasks not yet inherited
 * mode "shared"    → both combined (inherited first, then available)
 *
 * Uses cursor-based pagination on task.id (stable across sorts).
 */
export async function  getTasksPaginated(
  orgId: string,
  mode: "list" | "available" | "shared",
  options: {
    cursor?: string;
    limit?: number;
    sort?: TaskSortOption;
    search?: string;
    roleId?: string;
    tagId?: string;
  } = {},
): Promise<TasksPage> {
  const limit = Math.min(options.limit ?? 30, 100);
  const sort = options.sort ?? "name-asc";
  const cursor = options.cursor;
  const taskWhere = buildTaskWhere({
    search: options.search,
    roleId: options.roleId,
    tagId: options.tagId,
  });

  if (mode === "shared") {
    // Show inherited tasks first (phase "list"), then available tasks (phase "available").
    // Cursor encodes current phase + sub-cursor: JSON.stringify({ phase, cursor })
    let phase: "list" | "available" = "list";
    let subCursor: string | undefined;
    if (cursor) {
      try {
        const parsed = JSON.parse(cursor) as { phase?: string; cursor?: string | null };
        phase = parsed.phase === "available" ? "available" : "list";
        subCursor = parsed.cursor ?? undefined;
      } catch {
        // ignore invalid cursor — restart from beginning
      }
    }

    if (phase === "list") {
      const listPage = await getTasksPaginated(orgId, "list", {
        cursor: subCursor,
        limit,
        sort,
        search: options.search,
        roleId: options.roleId,
        tagId: options.tagId,
      });
      if (listPage.nextCursor) {
        return {
          tasks: listPage.tasks,
          nextCursor: JSON.stringify({ phase: "list", cursor: listPage.nextCursor }),
        };
      }
      // Inherited exhausted — fill remainder of this page with available tasks
      const remaining = limit - listPage.tasks.length;
      const availablePage = await getTasksPaginated(orgId, "available", {
        cursor: undefined,
        limit: remaining > 0 ? remaining : limit,
        sort,
        search: options.search,
        roleId: options.roleId,
        tagId: options.tagId,
      });
      return {
        tasks: [...listPage.tasks, ...availablePage.tasks],
        nextCursor: availablePage.nextCursor
          ? JSON.stringify({ phase: "available", cursor: availablePage.nextCursor })
          : null,
      };
    }

    // phase === "available"
    const availablePage = await getTasksPaginated(orgId, "available", {
      cursor: subCursor,
      limit,
      sort,
      search: options.search,
      roleId: options.roleId,
      tagId: options.tagId,
    });
    return {
      tasks: availablePage.tasks,
      nextCursor: availablePage.nextCursor
        ? JSON.stringify({ phase: "available", cursor: availablePage.nextCursor })
        : null,
    };
  }

  if (mode === "list") {
    const orderBy = sortOrderBy(sort);
    const inheritances = await prisma.taskInheritance.findMany({
      where: {
        orgId,
        ...(Object.keys(taskWhere).length > 0 && { task: taskWhere }),
      },
      include: { task: { include: taskInclude } },
      orderBy: { task: orderBy },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });
    const hasMore = inheritances.length > limit;
    const slice = hasMore ? inheritances.slice(0, limit) : inheritances;
    return {
      tasks: slice.map((i) => ({ ...i.task, _available: false as const })),
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
    };
  }

  // mode === "available"
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { parentId: true },
  });
  if (!org) return { tasks: [], nextCursor: null };

  const alreadyInherited = await prisma.taskInheritance
    .findMany({ where: { orgId }, select: { taskId: true } })
    .then((rows) => rows.map((r) => r.taskId));

  const franchiseParentId = org.parentId;
  const orderBy = sortOrderBy(sort);

  const rows = await prisma.task.findMany({
    where: {
      ...taskWhere,
      scope: TaskScope.GLOBAL,
      orgId: { not: orgId },
      ...(alreadyInherited.length > 0 && { id: { notIn: alreadyInherited } }),
      OR: franchiseParentId
        ? [
            { orgId: franchiseParentId },
            { organization: { parentId: franchiseParentId } },
          ]
        : [{ organization: { parentId: orgId } }],
    },
    include: taskInclude,
    orderBy,
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  return {
    tasks: slice.map((t) => ({ ...t, _available: true as const })),
    nextCursor: hasMore ? slice[slice.length - 1].id : null,
  };
}

/**
 * Returns a single task by ID, scoped to the org.
 * Returns null if not found.
 */
export async function getTaskById(orgId: string, taskId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, orgId },
    include: taskInclude,
  });
}

/**
 * Returns a task the org can access — either because it owns the task,
 * because it has an active TaskInheritance row, or because the task is
 * GLOBAL (viewable by any org even without inheriting it). Returns null
 * only if the task doesn't exist or isn't accessible.
 *
 * `isOwner: true`  — org owns the task (can edit, delete, publish)
 * `isOwner: false` — org has inherited or is viewing a shared GLOBAL task
 */
export async function getAccessibleTaskById(orgId: string, taskId: string) {
  const ownedTask = await prisma.task.findFirst({
    where: { id: taskId, orgId },
    include: taskInclude,
  });
  if (ownedTask) return { task: ownedTask, isOwner: true as const };

  // Check for explicit inheritance first, then fall back to GLOBAL visibility
  const [inheritance, sharedTask, viewerOrg] = await Promise.all([
    prisma.taskInheritance.findUnique({
      where: { taskId_orgId: { taskId, orgId } },
    }),
    prisma.task.findUnique({
      where: { id: taskId },
      include: taskInclude,
    }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, parentId: true },
    }),
  ]);

  if (!sharedTask || !viewerOrg) return null;

  // Allow viewing if the org has inherited it
  if (inheritance) return { task: sharedTask, isOwner: false as const };

  // For GLOBAL tasks, check franchise scoping
  if (sharedTask.scope === "GLOBAL") {
    const taskOrg = await prisma.organization.findUnique({
      where: { id: sharedTask.orgId },
      select: { id: true, parentId: true },
    });
    if (!taskOrg) return null;

    // Compare franchise roots
    const taskRoot = taskOrg.parentId ?? taskOrg.id;
    const viewerRoot = viewerOrg.parentId ?? viewerOrg.id;

    if (taskRoot === viewerRoot) {
      return { task: sharedTask, isOwner: false as const };
    }
  }

  return null;
}

/**
 * Updates mutable fields of a task, scoped to the org.
 */
export async function updateTask(
  orgId: string,
  taskId: string,
  data: UpdateTaskInput,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<null>> {
  const existing = await prisma.task.findFirst({
    where: { id: taskId, orgId },
    select: { name: true, color: true, description: true, durationMin: true },
  });
  const { count } = await prisma.task.updateMany({
    where: { id: taskId, orgId },
    data: {
      name: data.title,
      color: data.color,
      description: data.description ?? null,
      durationMin: data.durationMin,
      preferredStartTimeMin: data.preferredStartTimeMin ?? null,
      minPeople: data.peopleRequired ?? 1,
      minWaitDays: data.minWaitDays ?? null,
      maxWaitDays: data.maxWaitDays ?? null,
    },
  });
  if (count === 0)
    return { ok: false, error: "Task not found", code: "NOT_FOUND" };
  log.info("Task updated", { orgId, taskId });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "task.update",
    targetType: "Task",
    targetId: taskId,
    before: existing as import("@prisma/client").Prisma.InputJsonObject | null,
    after: {
      name: data.title,
      color: data.color,
      description: data.description ?? null,
      durationMin: data.durationMin,
    },
  });
  return { ok: true, data: null };
}

/**
 * Saves a Supabase Storage path as the task's image, replacing any previous
 * value. Pass `null` to clear the image. Scoped to orgId for safety.
 */
export async function updateTaskImageUrl(
  orgId: string,
  taskId: string,
  imageUrl: string | null,
): Promise<ServiceResult<null>> {
  const { count } = await prisma.task.updateMany({
    where: { id: taskId, orgId },
    data: { imageUrl },
  });
  if (count === 0)
    return { ok: false, error: "Task not found", code: "NOT_FOUND" };
  return { ok: true, data: null };
}

/**
 * Adds a role to a task's eligibility list.
 * No-op if the role is already eligible (skipDuplicates).
 */
export async function addTaskEligibility(
  orgId: string,
  taskId: string,
  roleId: string,
): Promise<ServiceResult<null>> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, orgId },
    select: { id: true },
  });
  if (!task) return { ok: false, error: "Task not found", code: "NOT_FOUND" };
  const role = await prisma.role.findFirst({
    where: { id: roleId, orgId },
    select: { id: true },
  });
  if (!role) return { ok: false, error: "Role not found", code: "NOT_FOUND" };
  await prisma.taskEligibility.upsert({
    where: { taskId_roleId: { taskId, roleId } },
    create: { taskId, roleId },
    update: {},
  });
  return { ok: true, data: null };
}

/**
 * Removes a role from a task's eligibility list.
 */
export async function removeTaskEligibility(
  orgId: string,
  taskId: string,
  roleId: string,
): Promise<ServiceResult<null>> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, orgId },
    select: { id: true },
  });
  if (!task) return { ok: false, error: "Task not found", code: "NOT_FOUND" };
  await prisma.taskEligibility.deleteMany({ where: { taskId, roleId } });
  return { ok: true, data: null };
}

/**
 * Bulk-inserts role eligibility rows for a task, skipping duplicates.
 * Used by createTaskAction to set initial eligibility after task creation.
 */
export async function setTaskEligibilities(
  orgId: string,
  taskId: string,
  roleIds: string[],
): Promise<void> {
  const validRoles =
    roleIds.length > 0
      ? await prisma.role.findMany({
          where: { id: { in: roleIds }, orgId },
          select: { id: true },
        })
      : [];
  const validIds = validRoles.map((r) => r.id);

  await prisma.$transaction([
    prisma.taskEligibility.deleteMany({ where: { taskId } }),
    prisma.taskEligibility.createMany({
      data: validIds.map((roleId) => ({ taskId, roleId })),
      skipDuplicates: true,
    }),
  ]);
}

/**
 * Returns a minimal list of all tasks for an org (id, name, color).
 * Used for lightweight dropdowns and selectors.
 */
export async function getTasksSimple(orgId: string) {
  return prisma.task.findMany({
    where: { orgId },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
}

export async function getTasksSimplePage(
  orgId: string,
  options: { page?: number; pageSize?: number; search?: string } = {},
) {
  const pageSize = Math.max(1, options.pageSize ?? 24);
  const search = options.search?.trim() ?? "";

  const where: Prisma.TaskWhereInput = {
    orgId,
    ...(search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : {}),
  };

  const totalCount = await prisma.task.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, Math.floor(options.page ?? 1)), totalPages);

  const tasks = await prisma.task.findMany({
    where,
    select: { id: true, name: true, color: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return { tasks, totalCount, totalPages, page, pageSize, search };
}

// ---------------------------------------------------------------------------
// Task accessibility helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if `orgId` either owns the task or has an active inheritance
 * record for it. Use this before creating timetable entries or displaying
 * task details to a franchisee org.
 */
export async function canAccessTask(
  orgId: string,
  taskId: string,
): Promise<boolean> {
  const [owned, inherited] = await Promise.all([
    prisma.task.findFirst({
      where: { id: taskId, orgId },
      select: { id: true },
    }),
    prisma.taskInheritance.findUnique({
      where: { taskId_orgId: { taskId, orgId } },
    }),
  ]);
  return !!(owned || inherited);
}

// ---------------------------------------------------------------------------
// Publish / unpublish
// ---------------------------------------------------------------------------

/**
 * Publishes a task (scope → GLOBAL). Child orgs can then discover and
 * voluntarily inherit the task via the Shared Tasks view.
 */
export async function publishTask(
  orgId: string,
  taskId: string,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<null>> {
  const { count } = await prisma.task.updateMany({
    where: { id: taskId, orgId },
    data: { scope: TaskScope.GLOBAL },
  });
  if (count === 0)
    return { ok: false, error: "Task not found", code: "NOT_FOUND" };

  log.info("Task published", { orgId, taskId });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "task.publish",
    targetType: "Task",
    targetId: taskId,
  });
  return { ok: true, data: null };
}

/**
 * Makes a task private again (scope → ORG). When `removeFromChildren` is true,
 * inheritance rows for all direct child orgs are deleted.
 */
export async function unpublishTask(
  orgId: string,
  taskId: string,
  removeFromChildren: boolean,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<null>> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, orgId },
    select: { id: true },
  });
  if (!task) return { ok: false, error: "Task not found", code: "NOT_FOUND" };

  if (removeFromChildren) {
    await prisma.$transaction([
      prisma.task.update({
        where: { id: taskId },
        data: { scope: TaskScope.ORG },
      }),
      prisma.taskInheritance.deleteMany({
        where: { taskId, orgId: { not: orgId } },
      }),
    ]);
  } else {
    await prisma.task.update({
      where: { id: taskId },
      data: { scope: TaskScope.ORG },
    });
  }

  log.info("Task unpublished", { orgId, taskId, removeFromChildren });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "task.unpublish",
    targetType: "Task",
    targetId: taskId,
    after: { removeFromChildren },
  });
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Franchisee: inherit / remove
// ---------------------------------------------------------------------------

/**
 * Creates a TaskInheritance row so an org gains access to a GLOBAL task from
 * its parent. Copies the parent's section layout as a starting point.
 * Returns FORBIDDEN when the org has no parent, NOT_FOUND when the task is not
 * published, and CONFLICT when the org already inherited the task.
 */
export async function inheritTask(
  orgId: string,
  taskId: string,
): Promise<ServiceResult<null>> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      scope: TaskScope.GLOBAL,
      orgId: { not: orgId },
    },
    select: { id: true, orgId: true },
  });
  if (!task)
    return { ok: false, error: "Task not available", code: "NOT_FOUND" };

  const [requestingOrg, taskOwnerOrg] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, parentId: true },
    }),
    prisma.organization.findUnique({
      where: { id: task.orgId },
      select: { id: true, parentId: true },
    }),
  ]);

  if (!requestingOrg || !taskOwnerOrg) {
    return { ok: false, error: "Forbidden", code: "FORBIDDEN" };
  }

  const isRelated =
    requestingOrg.parentId === taskOwnerOrg.id ||
    taskOwnerOrg.parentId === requestingOrg.id ||
    (requestingOrg.parentId &&
      requestingOrg.parentId === taskOwnerOrg.parentId);

  if (!isRelated) {
    return { ok: false, error: "Forbidden", code: "FORBIDDEN" };
  }

  const existing = await prisma.taskInheritance.findUnique({
    where: { taskId_orgId: { taskId, orgId } },
  });
  if (existing) return { ok: false, error: "Already added", code: "CONFLICT" };

  await prisma.taskInheritance.create({ data: { taskId, orgId } });
  await copySectionLayout(taskId, task.orgId, orgId);

  log.info("Task inherited", { orgId, taskId });
  return { ok: true, data: null };
}

/**
 * Removes a franchisee's inheritance of a task. The task definition itself is
 * unaffected.
 */
export async function removeInheritedTask(
  orgId: string,
  taskId: string,
): Promise<ServiceResult<null>> {
  const { count } = await prisma.taskInheritance.deleteMany({
    where: { taskId, orgId },
  });
  if (count === 0)
    return { ok: false, error: "Inheritance not found", code: "NOT_FOUND" };
  log.info("Task inheritance removed", { orgId, taskId });
  return { ok: true, data: null };
}
