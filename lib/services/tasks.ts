import { TaskScope } from "@prisma/client";
import { log } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit-log";
import {
  copySectionLayout,
  createDefaultSectionLayouts,
} from "@/lib/services/task-sections";
import type { ServiceResult } from "./types";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validators/task";

/**
 * Creates a new task for the given org using validated input.
 * Optional fields are null-coalesced so callers never need to handle `undefined`.
 */
export async function createTask(
  orgId: string,
  data: CreateTaskInput,
  actorId?: string | null,
  actorEmail?: string | null,
) {
  const task = await prisma.task.create({
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
    },
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
  // Seed default section layout rows for the owning org.
  await createDefaultSectionLayouts(task.id, orgId);
  return task;
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
} as const;

/**
 * Returns all tasks for the given org, sorted newest-first.
 * Includes role eligibility data for display in the task table.
 */
export async function getTasks(orgId: string) {
  return prisma.task.findMany({
    where: { orgId },
    include: taskInclude,
    orderBy: { createdAt: "desc" },
  });
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
 * Returns a task the org can access — either because it owns the task or
 * because it has an active TaskInheritance row. Returns null if neither.
 * The `isOwner` flag distinguishes between the two cases so callers can
 * conditionally render publish controls, edit buttons, etc.
 */
export async function getAccessibleTaskById(orgId: string, taskId: string) {
  const ownedTask = await prisma.task.findFirst({
    where: { id: taskId, orgId },
    include: taskInclude,
  });
  if (ownedTask) return { task: ownedTask, isOwner: true as const };

  const inheritance = await prisma.taskInheritance.findUnique({
    where: { taskId_orgId: { taskId, orgId } },
  });
  if (!inheritance) return null;

  const inheritedTask = await prisma.task.findUnique({
    where: { id: taskId },
    include: taskInclude,
  });
  if (!inheritedTask) return null;

  return { task: inheritedTask, isOwner: false as const };
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
  if (roleIds.length === 0) return;
  const validRoles = await prisma.role.findMany({
    where: { id: { in: roleIds }, orgId },
    select: { id: true },
  });
  if (validRoles.length === 0) return;
  await prisma.taskEligibility.createMany({
    data: validRoles.map(({ id: roleId }) => ({ taskId, roleId })),
    skipDuplicates: true,
  });
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

// ---------------------------------------------------------------------------
// Task accessibility helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if `orgId` either owns the task or has an active inheritance
 * record for it. Use this before creating timetable entries or displaying
 * task details to a franchisee org.
 */
export async function canAccessTask(orgId: string, taskId: string): Promise<boolean> {
  const [owned, inherited] = await Promise.all([
    prisma.task.findFirst({ where: { id: taskId, orgId }, select: { id: true } }),
    prisma.taskInheritance.findUnique({
      where: { taskId_orgId: { taskId, orgId } },
    }),
  ]);
  return !!(owned || inherited);
}

/**
 * Returns all tasks accessible to an org — its own tasks plus any tasks it
 * has inherited from its parent. Each result carries an `inherited: boolean`
 * flag so callers can distinguish the two sets.
 */
export async function getAccessibleTasks(orgId: string) {
  const [ownTasks, inheritances] = await Promise.all([
    prisma.task.findMany({ where: { orgId }, include: taskInclude }),
    prisma.taskInheritance.findMany({
      where: { orgId },
      include: { task: { include: taskInclude } },
    }),
  ]);
  return [
    ...ownTasks.map((t) => ({ ...t, inherited: false as const })),
    ...inheritances.map((i) => ({ ...i.task, inherited: true as const })),
  ];
}

/**
 * Returns GLOBAL tasks (available to add) and already-inherited tasks from the
 * parent org. Returns an empty array when the org has no parent.
 *
 * Each task includes an `inheritedBy` array with 0 or 1 entries so the UI can
 * tell at a glance whether the org has already added a given task.
 */
export async function getSharedTasks(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { parentId: true },
  });
  if (!org?.parentId) return { parentOrgId: null as null, tasks: [] };

  const inheritedIds = await prisma.taskInheritance
    .findMany({ where: { orgId }, select: { taskId: true } })
    .then((rows) => rows.map((r) => r.taskId));

  const tasks = await prisma.task.findMany({
    where: {
      orgId: org.parentId,
      OR: [
        { scope: TaskScope.GLOBAL },
        // FROZEN tasks already inherited while they were GLOBAL stay visible
        { scope: TaskScope.FROZEN, id: { in: inheritedIds.length ? inheritedIds : ["__none__"] } },
      ],
    },
    include: {
      ...taskInclude,
      inheritedBy: {
        where: { orgId },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return { parentOrgId: org.parentId, tasks };
}

// ---------------------------------------------------------------------------
// Publish / freeze / unpublish
// ---------------------------------------------------------------------------

/**
 * Publishes a task (scope → GLOBAL) and creates TaskInheritance rows for every
 * current child org that does not already have one. Section layouts are copied
 * outside the transaction because they are best-effort — the inheritance row is
 * the source of truth.
 */
export async function publishTask(
  orgId: string,
  taskId: string,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<null>> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, orgId },
    select: { id: true },
  });
  if (!task) return { ok: false, error: "Task not found", code: "NOT_FOUND" };

  const children = await prisma.organization.findMany({
    where: { parentId: orgId },
    select: { id: true },
  });

  // Find which children are new (no existing inheritance row)
  const existingInheritances = await prisma.taskInheritance.findMany({
    where: { taskId, orgId: { in: children.map((c) => c.id) } },
    select: { orgId: true },
  });
  const alreadyInherited = new Set(existingInheritances.map((r) => r.orgId));
  const newChildIds = children.map((c) => c.id).filter((id) => !alreadyInherited.has(id));

  await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data: { scope: TaskScope.GLOBAL } }),
    ...newChildIds.map((childOrgId) =>
      prisma.taskInheritance.create({ data: { taskId, orgId: childOrgId } }),
    ),
  ]);

  // Copy layouts after the transaction (best-effort)
  for (const childOrgId of newChildIds) {
    await copySectionLayout(taskId, orgId, childOrgId);
  }

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
 * Freezes a task (scope → FROZEN). Existing inheritance rows are left intact;
 * new child orgs will no longer auto-inherit this task.
 */
export async function freezeTask(
  orgId: string,
  taskId: string,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<null>> {
  const { count } = await prisma.task.updateMany({
    where: { id: taskId, orgId },
    data: { scope: TaskScope.FROZEN },
  });
  if (count === 0) return { ok: false, error: "Task not found", code: "NOT_FOUND" };

  log.info("Task frozen", { orgId, taskId });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "task.freeze",
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
    const childOrgIds = await prisma.organization
      .findMany({ where: { parentId: orgId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));

    await prisma.$transaction([
      prisma.task.update({ where: { id: taskId }, data: { scope: TaskScope.ORG } }),
      prisma.taskInheritance.deleteMany({
        where: { taskId, orgId: { in: childOrgIds } },
      }),
    ]);
  } else {
    await prisma.task.update({ where: { id: taskId }, data: { scope: TaskScope.ORG } });
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
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { parentId: true },
  });
  if (!org?.parentId) return { ok: false, error: "No parent org", code: "FORBIDDEN" };

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      orgId: org.parentId,
      scope: TaskScope.GLOBAL,
    },
    select: { id: true },
  });
  if (!task) return { ok: false, error: "Task not available", code: "NOT_FOUND" };

  const existing = await prisma.taskInheritance.findUnique({
    where: { taskId_orgId: { taskId, orgId } },
  });
  if (existing) return { ok: false, error: "Already added", code: "CONFLICT" };

  await prisma.taskInheritance.create({ data: { taskId, orgId } });
  await copySectionLayout(taskId, org.parentId, orgId);

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
