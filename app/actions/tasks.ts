"use server";

/**
 * Server Actions for task management.
 *
 * createTaskAction — used by the create-task form. Parses FormData, validates with
 * `createTaskSchema`, delegates to the task service, then revalidates the task list
 * and redirects back to it.
 *
 * deleteTaskAction — called by the TaskTable row menu. Requires MANAGE_TASKS.
 * Delegates to the task service (scoped delete) and revalidates the task list.
 */

import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionAction } from "@/lib/authz";
import { createTask, deleteTask } from "@/lib/services/tasks";
import { createTaskSchema } from "@/lib/validators/task";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateTaskFormState =
  | { ok: false; errors: Record<string, string[]> }
  | { ok: true }
  | null;

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

  // FormData values are always strings; convert numeric fields to numbers
  // before passing to the Zod schema which expects `number`.
  const num = (key: string) => {
    const v = formData.get(key);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  };

  const raw = {
    title: String(formData.get("title") ?? ""),
    description: formData.get("description") || undefined,
    durationMin: num("durationMin"),
    preferredStartTimeMin: num("preferredStartTimeMin"),
    peopleRequired: num("peopleRequired") ?? 1,
    minWaitDays: num("minWaitDays"),
    maxWaitDays: num("maxWaitDays"),
  };

  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await createTask(orgId, parsed.data);
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

  const result = await deleteTask(orgId, taskId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/tasks`);
  return { ok: true };
}
