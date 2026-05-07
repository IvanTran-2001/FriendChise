"use server";

/**
 * Server Actions for task management.
 *
 * createTaskAction    — create-task form; parses FormData, validates with `createTaskSchema`,
 *                       delegates to the task service, then revalidates and redirects.
 * updateTaskAction    — edit-task form; same pipeline but updates an existing task.
 * deleteTaskAction    — task-table row menu; scoped delete, requires MANAGE_TASKS.
 * addEligibilityAction    — toggle a role onto a task's eligibility list.
 * removeEligibilityAction — toggle a role off a task's eligibility list.
 */

import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionAction } from "@/lib/authz";
import {
  createTask,
  deleteTask,
  updateTask,
  addTaskEligibility,
  removeTaskEligibility,
  setTaskEligibilities,
} from "@/lib/services/tasks";
import {
  addTagToTask,
  removeTagFromTask,
  setTaskTags,
  createTag,
} from "@/lib/services/tags";
import { createTaskSchema, updateTaskSchema } from "@/lib/validators/task";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Parses numeric and string fields from a task FormData submission. */
function parseTaskFormData(formData: FormData) {
  const num = (key: string) => {
    const v = formData.get(key);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  };

  const minWaitDaysRaw = num("minWaitDays");
  const maxWaitDaysRaw = num("maxWaitDays");
  const bothEmpty =
    minWaitDaysRaw === undefined && maxWaitDaysRaw === undefined;

  return {
    color: String(formData.get("color") ?? "#6366f1"),
    title: String(formData.get("title") ?? ""),
    description: formData.get("description") || undefined,
    durationMin: num("durationMin"),
    preferredStartTimeMin: num("preferredStartTimeMin"),
    peopleRequired: num("peopleRequired") ?? 1,
    minWaitDays: bothEmpty ? 0 : minWaitDaysRaw,
    maxWaitDays: bothEmpty ? 0 : maxWaitDaysRaw,
  };
}

export type CreateTaskFormState =
  | { ok: false; errors: Record<string, string[]> }
  | { ok: true }
  | null;

/**
 * Creates a new task definition for an org and sets its initial role eligibility.
 *
 * Auth: caller must hold `MANAGE_TASKS` in this org.
 * Parses raw `FormData` (all values are strings from the browser) converting
 * numeric fields before Zod validation. Eligibility role IDs are taken from
 * repeated `"roleIds"` entries on the form. On success, revalidates the task
 * list and redirects there.
 */
export async function createTaskAction(
  orgId: string,
  _prev: CreateTaskFormState,
  formData: FormData,
): Promise<CreateTaskFormState> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, errors: { _: ["Unauthorized"] } };

  const raw = parseTaskFormData(formData);
  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const task = await createTask(
    orgId,
    parsed.data,
    authz.userId,
    authz.userEmail,
  );
  const roleIds = formData
    .getAll("roleIds")
    .filter((v): v is string => typeof v === "string");
  if (roleIds.length > 0) {
    await setTaskEligibilities(orgId, task.id, roleIds);
  }
  const tagIds = formData
    .getAll("tagIds")
    .filter((v): v is string => typeof v === "string");
  if (tagIds.length > 0) {
    await setTaskTags(orgId, task.id, tagIds);
  }
  revalidatePath(`/orgs/${orgId}/tasks`);
  redirect(`/orgs/${orgId}/tasks`);
}

/**
 * Deletes a task definition for an org.
 *
 * Auth: caller must hold `MANAGE_TASKS` in this org.
 * Delegates to `deleteTask` which scopes the delete to `orgId` to prevent
 * cross-org deletion. Revalidates the tasks list on success.
 */
export async function deleteTaskAction(
  orgId: string,
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized." };

  const result = await deleteTask(orgId, taskId, authz.userId, authz.userEmail);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/tasks`);
  return { ok: true };
}

export type TaskFormState =
  | { ok: false; errors: Record<string, string[]> }
  | { ok: true }
  | null;

/**
 * Updates a task definition's fields for an org.
 *
 * Auth: caller must hold `MANAGE_TASKS` in this org.
 * Parses raw `FormData`, validates with `updateTaskSchema`, then delegates to
 * `updateTask`. On success, revalidates both the task list and the edit page.
 */
export async function updateTaskAction(
  orgId: string,
  taskId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, errors: { _: ["Unauthorized"] } };

  const raw = parseTaskFormData(formData);
  const parsed = updateTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await updateTask(
    orgId,
    taskId,
    parsed.data,
    authz.userId,
    authz.userEmail,
  );
  if (!result.ok) return { ok: false, errors: { _: [result.error] } };

  revalidatePath(`/orgs/${orgId}/tasks`);
  revalidatePath(`/orgs/${orgId}/tasks/${taskId}/edit`);
  return { ok: true };
}

/**
 * Attaches an existing tag to a task. Requires `MANAGE_TASKS`.
 */
export async function addTagAction(
  orgId: string,
  taskId: string,
  tagId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  const result = await addTagToTask(orgId, taskId, tagId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/orgs/${orgId}/tasks`);
  revalidatePath(`/orgs/${orgId}/tasks/${taskId}/edit`);
  return { ok: true };
}

/**
 * Removes a tag from a task. Requires `MANAGE_TASKS`.
 */
export async function removeTagAction(
  orgId: string,
  taskId: string,
  tagId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  const result = await removeTagFromTask(orgId, taskId, tagId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/orgs/${orgId}/tasks`);
  revalidatePath(`/orgs/${orgId}/tasks/${taskId}/edit`);
  return { ok: true };
}

/**
 * Creates a new org-scoped tag and immediately attaches it to a task.
 * Used from the edit-mode TagPanel when a user types a name that doesn't exist.
 * Requires `MANAGE_TASKS`.
 */
export async function createAndAddTagAction(
  orgId: string,
  taskId: string,
  name: string,
): Promise<
  | { ok: true; tag: { id: string; name: string; color: string } }
  | { ok: false; error: string }
> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  const tagResult = await createTag(
    orgId,
    { name: name.trim() },
    authz.userId,
    authz.userEmail,
  );
  if (!tagResult.ok) return { ok: false, error: tagResult.error };
  const addResult = await addTagToTask(orgId, taskId, tagResult.data.id);
  if (!addResult.ok) return { ok: false, error: addResult.error };
  revalidatePath(`/orgs/${orgId}/tasks`);
  revalidatePath(`/orgs/${orgId}/tasks/${taskId}/edit`);
  return { ok: true, tag: tagResult.data };
}

/**
 * Adds a role to a task's eligibility list (upsert — safe if already present).
 * Requires `MANAGE_TASKS` permission.
 */
export async function addEligibilityAction(
  orgId: string,
  taskId: string,
  roleId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  const result = await addTaskEligibility(orgId, taskId, roleId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/orgs/${orgId}/tasks`);
  revalidatePath(`/orgs/${orgId}/tasks/${taskId}/edit`);
  return { ok: true };
}

/**
 * Removes a role from a task's eligibility list.
 * Requires `MANAGE_TASKS` permission.
 */
export async function removeEligibilityAction(
  orgId: string,
  taskId: string,
  roleId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  const result = await removeTaskEligibility(orgId, taskId, roleId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/orgs/${orgId}/tasks`);
  revalidatePath(`/orgs/${orgId}/tasks/${taskId}/edit`);
  return { ok: true };
}
