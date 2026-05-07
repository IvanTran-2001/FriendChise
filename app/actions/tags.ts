"use server";

/**
 * Server Actions for tag management.
 *
 * createTagAction        — create a new org tag (MANAGE_SETTINGS)
 * deleteTagAction        — delete a custom org tag (MANAGE_SETTINGS)
 * addTagToTaskAction     — attach a tag to a task (MANAGE_TASKS)
 * removeTagFromTaskAction — detach a tag from a task (MANAGE_TASKS)
 */

import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionAction } from "@/lib/authz";
import {
  createTag,
  updateTag,
  deleteTag,
  addTagToTask,
  removeTagFromTask,
  setTagTasks,
} from "@/lib/services/tags";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

// ─── MANAGE_SETTINGS ─────────────────────────────────────────────────────────

export async function createTagAction(
  orgId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_SETTINGS);
  if (!authz.ok) return { ok: false, error: "Unauthorized." };

  const name = String(formData.get("name") ?? "").trim();
  const color = (String(formData.get("color") ?? "") || "#6B7280").trim();

  if (!name) return { ok: false, error: "Tag name is required." };

  const result = await createTag(orgId, { name, color }, authz.userId, authz.userEmail);
  if (!result.ok) return { ok: false, error: result.error };

  const taskIds = (formData.getAll("taskIds") as string[]).filter(Boolean);
  if (taskIds.length > 0) {
    await setTagTasks(orgId, result.data.id, taskIds);
  }

  revalidatePath(`/orgs/${orgId}/settings/tags`);
  return { ok: true };
}

export async function deleteTagAction(
  orgId: string,
  tagId: string,
): Promise<ActionResult> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_SETTINGS);
  if (!authz.ok) return { ok: false, error: "Unauthorized." };

  const result = await deleteTag(orgId, tagId, authz.userId, authz.userEmail);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/settings/tags`);
  return { ok: true };
}

export async function updateTagAction(
  orgId: string,
  tagId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_SETTINGS);
  if (!authz.ok) return { ok: false, error: "Unauthorized." };

  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();

  if (!name) return { ok: false, error: "Tag name is required." };

  const result = await updateTag(orgId, tagId, { name, color: color || undefined }, authz.userId, authz.userEmail);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/settings/tags`);
  return { ok: true };
}

// ─── MANAGE_TASKS ─────────────────────────────────────────────────────────────

export async function addTagToTaskAction(
  orgId: string,
  taskId: string,
  tagId: string,
): Promise<ActionResult> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return { ok: false, error: "Unauthorized." };

  const result = await addTagToTask(orgId, taskId, tagId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/tasks`);
  revalidatePath(`/orgs/${orgId}/tasks/${taskId}`);
  return { ok: true };
}

export async function removeTagFromTaskAction(
  orgId: string,
  taskId: string,
  tagId: string,
): Promise<ActionResult> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return { ok: false, error: "Unauthorized." };

  const result = await removeTagFromTask(orgId, taskId, tagId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/tasks`);
  revalidatePath(`/orgs/${orgId}/tasks/${taskId}`);
  return { ok: true };
}
