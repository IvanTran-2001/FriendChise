import { log } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit-log";
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
