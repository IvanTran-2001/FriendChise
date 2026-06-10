"use server";

/**
 * Server Actions for task management.
 *
 * Task CRUD
 * ─────────
 * createTaskAction          — create-task form; parses FormData, validates with `createTaskSchema`,
 *                             creates default section layout rows, auto-creates the owning org's
 *                             TaskInheritance row, then revalidates and redirects.
 * updateTaskAction          — edit-task form; updates fields, revalidates list + detail page.
 * deleteTaskAction          — task-table row menu; scoped delete, requires MANAGE_TASKS.
 *                             Accepts callers who are the franchise root owner OR hold
 *                             MANAGE_TASKS in the task's owning org.
 *
 * Eligibility
 * ───────────
 * addEligibilityAction      — toggle a role onto a task's eligibility list.
 * removeEligibilityAction   — toggle a role off a task's eligibility list.
 *
 * Tags
 * ────
 * addTagAction              — attach an existing tag to a task.
 * removeTagAction           — detach a tag from a task.
 * createAndAddTagAction     — create a new org-scoped tag and immediately attach it.
 *
 * Scope (publish / unpublish)
 * ───────────────────────────
 * publishTaskAction         — set scope → GLOBAL; franchisees can now discover the task.
 * unpublishTaskAction       — revert scope → ORG; optionally remove from child orgs.
 *
 * Franchise inheritance
 * ─────────────────────
 * inheritTaskAction         — add a GLOBAL task to this org's library (creates TaskInheritance
 *                             row and copies the parent's section layout).
 * removeTaskFromListAction  — remove an inherited task from this org's library.
 * removeInheritedTaskAction — alias for removeTaskFromListAction (convenience export).
 *
 * Section layout
 * ──────────────
 * getSectionLayoutAction    — fetch the section layout for a task+org (MANAGE_TASKS required).
 * updateSectionLayoutAction — bulk-upsert section layout rows for a task+org (MANAGE_TASKS required).
 */

import { PermissionAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireOrgPermissionAction,
  requireParentOrgOwnerAction,
} from "@/lib/authz";
import {
  canAccessTask,
  createTask,
  deleteTask,
  getTaskOwnerOrgId,
  inheritTask,
  publishTask,
  removeInheritedTask,
  unpublishTask,
  updateTask,
  addTaskEligibility,
  removeTaskEligibility,
  setTaskEligibilities,
} from "@/lib/services/tasks";
import {
  getSectionLayout,
  updateSectionLayouts,
  type SectionLayoutInput,
} from "@/lib/services/task-sections";
import {
  addTagToTask,
  removeTagFromTask,
  setTaskTags,
  createTag,
} from "@/lib/services/tags";
import { saveTaskImagePath } from "@/app/actions/storage";
import { createTaskSchema, updateTaskSchema } from "@/lib/validators/task";
import { checkDemoLimit } from "@/lib/demo";
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

  const demoCheck = await checkDemoLimit(authz.userEmail, "task", orgId);
  if (!demoCheck.ok) return { ok: false, errors: { _: [demoCheck.error] } };

  const raw = parseTaskFormData(formData);
  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  let creatorName: string | undefined;
  try {
    const creator = await prisma.user.findUnique({
      where: { id: authz.userId },
      select: { name: true },
    });
    creatorName = creator?.name ?? undefined;
  } catch {
    creatorName = undefined;
  }

  const task = await createTask(
    orgId,
    parsed.data,
    authz.userId,
    authz.userEmail,
    creatorName ?? null,
  );
  const imageStoragePath = formData.get("imageStoragePath");
  if (typeof imageStoragePath === "string" && imageStoragePath.trim()) {
    const imageResult = await saveTaskImagePath(
      orgId,
      task.id,
      imageStoragePath,
    );
    if (!imageResult.ok) {
      // Rollback: delete the partially-created task
      try {
        await deleteTask(orgId, task.id, authz.userId, authz.userEmail);
      } catch (deleteErr) {
        console.error("Failed to rollback task creation:", deleteErr);
      }
      return { ok: false, errors: { _: [imageResult.error] } };
    }
  }
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
  const taskOrgId = await getTaskOwnerOrgId(taskId);
  if (!taskOrgId) return { ok: false, error: "Task not found." };

  // Franchise root owner OR has MANAGE_TASKS in the task's org.
  const [franchiseAuthz, taskOrgAuthz] = await Promise.all([
    requireParentOrgOwnerAction(orgId),
    requireOrgPermissionAction(taskOrgId, PermissionAction.MANAGE_TASKS),
  ]);
  if (!franchiseAuthz.ok && !taskOrgAuthz.ok)
    return { ok: false, error: "Unauthorized." };

  const authz = (franchiseAuthz.ok ? franchiseAuthz : taskOrgAuthz) as {
    ok: true;
    userId: string;
    userEmail: string | null;
  };

  const result = await deleteTask(
    taskOrgId,
    taskId,
    authz.userId,
    authz.userEmail,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/tasks`);
  return { ok: true };
}

/**
 * Removes a task from an org's list by deleting the TaskInheritance row.
 * The task definition itself is untouched. Requires MANAGE_TASKS.
 */
export async function removeTaskFromListAction(
  orgId: string,
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized." };

  const result = await removeInheritedTask(orgId, taskId);
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
  const taskOrgId = await getTaskOwnerOrgId(taskId);
  if (!taskOrgId) return { ok: false, errors: { _: ["Task not found"] } };

  // Franchise root owner OR has MANAGE_TASKS in the task's org.
  const [franchiseAuthz, taskOrgAuthz] = await Promise.all([
    requireParentOrgOwnerAction(orgId),
    requireOrgPermissionAction(taskOrgId, PermissionAction.MANAGE_TASKS),
  ]);
  if (!franchiseAuthz.ok && !taskOrgAuthz.ok)
    return { ok: false, errors: { _: ["Unauthorized"] } };

  const authz = (franchiseAuthz.ok ? franchiseAuthz : taskOrgAuthz) as {
    ok: true;
    userId: string;
    userEmail: string | null;
  };

  const raw = parseTaskFormData(formData);
  const parsed = updateTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await updateTask(
    taskOrgId,
    taskId,
    parsed.data,
    authz.userId,
    authz.userEmail,
  );
  if (!result.ok) return { ok: false, errors: { _: [result.error] } };

  // When the edit form includes deferred tag/role lists, apply them atomically.
  if (formData.get("tagsSubmitted") === "1") {
    const tagIds = formData
      .getAll("tagIds")
      .filter((v): v is string => typeof v === "string");
    await setTaskTags(taskOrgId, taskId, tagIds);
  }
  if (formData.get("rolesSubmitted") === "1") {
    const roleIds = formData
      .getAll("roleIds")
      .filter((v): v is string => typeof v === "string");
    await setTaskEligibilities(taskOrgId, taskId, roleIds);
  }

  revalidatePath(`/orgs/${orgId}/tasks`);
  revalidatePath(`/orgs/${orgId}/tasks/${taskId}`);
  return { ok: true };
}

/**
 * Creates a new org-scoped tag without attaching it to any task.
 * Used by the deferred edit form so tag creation happens immediately but
 * the attachment is committed only on Save.
 * Requires `MANAGE_TASKS`.
 */
export async function createTagOnlyAction(
  orgId: string,
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
  const result = await createTag(
    orgId,
    { name: name.trim() },
    authz.userId,
    authz.userEmail,
  );
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/orgs/${orgId}/tasks`);
  return { ok: true, tag: result.data };
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

// ---------------------------------------------------------------------------
// Task scope actions (publish / unpublish)
// ---------------------------------------------------------------------------

/**
 * Sets a task's scope to GLOBAL and creates inheritance rows for every current
 * child org. Only the task-owning org (franchisor) can call this.
 * Requires `MANAGE_TASKS`.
 */
export async function publishTaskAction(
  orgId: string,
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  const result = await publishTask(
    orgId,
    taskId,
    authz.userId,
    authz.userEmail,
  );
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/orgs/${orgId}/tasks`);
  revalidatePath(`/orgs/${orgId}/tasks/${taskId}`);
  return { ok: true };
}

/**
 * Reverts a task to ORG scope (private). When `removeFromChildren` is true,
 * inheritance rows for all direct child orgs are deleted so they lose access.
 * Requires `MANAGE_TASKS`.
 */
export async function unpublishTaskAction(
  orgId: string,
  taskId: string,
  removeFromChildren: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  const result = await unpublishTask(
    orgId,
    taskId,
    removeFromChildren,
    authz.userId,
    authz.userEmail,
  );
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/orgs/${orgId}/tasks`);
  revalidatePath(`/orgs/${orgId}/tasks/${taskId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Franchisee: inherit / remove
// ---------------------------------------------------------------------------

/**
 * Adds a GLOBAL task from the parent org to this org's task library.
 * Creates a TaskInheritance row and copies the parent's section layout.
 * Requires `MANAGE_TASKS`.
 */
export async function inheritTaskAction(
  orgId: string,
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  const result = await inheritTask(orgId, taskId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/orgs/${orgId}/tasks`);
  return { ok: true };
}

/**
 * Removes a franchisee's access to an inherited task.
 * Requires `MANAGE_TASKS`.
 */
export async function removeInheritedTaskAction(
  orgId: string,
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  const result = await removeInheritedTask(orgId, taskId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/orgs/${orgId}/tasks`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Section layout
// ---------------------------------------------------------------------------

/**
 * Fetches the section layout for a task+org. Accessible to any member with
 * MANAGE_TASKS whose org owns or has inherited the task.
 */
export async function getSectionLayoutAction(
  orgId: string,
  taskId: string,
): Promise<
  | { ok: true; sections: Awaited<ReturnType<typeof getSectionLayout>> }
  | { ok: false; error: string }
> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  const accessible = await canAccessTask(orgId, taskId);
  if (!accessible) return { ok: false, error: "Task not found" };
  const sections = await getSectionLayout(taskId, orgId);
  return { ok: true, sections };
}

/**
 * Saves the section layout for a task+org (full replacement via upsert).
 * Requires `MANAGE_TASKS` and access to the task.
 */
export async function updateSectionLayoutAction(
  orgId: string,
  taskId: string,
  sections: SectionLayoutInput[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  const accessible = await canAccessTask(orgId, taskId);
  if (!accessible) return { ok: false, error: "Task not found" };
  await updateSectionLayouts(taskId, orgId, sections);
  revalidatePath(`/orgs/${orgId}/tasks/${taskId}`);
  return { ok: true };
}
