"use server";

/**
 * @file templates.ts
 * Server actions for managing timetable templates and applying them to the live timetable.
 *
 * All actions require an authenticated session and the appropriate org permission.
 * Mutations call `revalidatePath` so the Next.js cache is invalidated on success.
 */

import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionAction } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createTemplateSchema } from "@/lib/validators/template";
import {
  createTemplate,
  addTemplateInstance,
  removeTemplateInstance,
  updateTemplateInstance,
  updateTemplateDays,
  addTemplateInstanceAssignee,
  removeTemplateInstanceAssignee,
  countTimetableEntriesInRange,
  applyTemplate,
} from "@/lib/services/templates";

export type CreateTemplateFormState =
  | { ok: false; errors: Record<string, string[]> }
  | { ok: true }
  | null;

/**
 * Creates a new template for the org and redirects to its edit page.
 * Requires MANAGE_TASKS permission.
 */
export async function createTemplateAction(
  orgId: string,
  _prev: CreateTemplateFormState,
  formData: FormData,
): Promise<CreateTemplateFormState> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, errors: { _: ["Unauthorized"] } };

  const parsed = createTemplateSchema.safeParse({
    name: formData.get("title"),
    cycleLengthDays: formData.get("templateDays") ?? 7,
  });
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      (errors[key] ??= []).push(issue.message);
    }
    return { ok: false, errors };
  }

  const result = await createTemplate(orgId, parsed.data.name, parsed.data.cycleLengthDays);
  if (!result.ok) return { ok: false, errors: { _: [result.error] } };

  revalidatePath(`/orgs/${orgId}/timetable/templates`);
  redirect(`/orgs/${orgId}/timetable/templates/${result.data.id}`);
}

/**
 * Adds a task entry to a template at the given day index and start time.
 * Requires MANAGE_TASKS permission.
 * `endTimeMin` defaults to `startTimeMin + 60`, capped at 23:59.
 */
export async function addTemplateInstanceAction(
  orgId: string,
  templateId: string,
  taskId: string,
  dayIndex: number,
  startTimeMin: number,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await addTemplateInstance(orgId, templateId, taskId, dayIndex, startTimeMin);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/timetable/templates/${templateId}`);
  return { ok: true };
}

/**
 * Removes a single entry from a template.
 * Requires MANAGE_TASKS permission.
 */
export async function removeTemplateInstanceAction(
  orgId: string,
  instanceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await removeTemplateInstance(orgId, instanceId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/timetable/templates`);
  return { ok: true };
}

/**
 * Updates the `dayIndex` and/or `startTimeMin` of a template entry.
 * Requires MANAGE_TASKS permission.
 */
export async function updateTemplateInstanceAction(
  orgId: string,
  instanceId: string,
  update: { dayIndex?: number; startTimeMin?: number },
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await updateTemplateInstance(orgId, instanceId, update);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/timetable/templates`);
  return { ok: true };
}

/**
 * Resizes a template's cycle length.
 * Blocks the operation if any existing entries have a `dayIndex` that would
 * fall outside the new length — the user must move or remove them first.
 * Requires MANAGE_TASKS permission.
 */
export async function updateTemplateDaysAction(
  orgId: string,
  templateId: string,
  cycleLengthDays: number,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await updateTemplateDays(orgId, templateId, cycleLengthDays);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/timetable/templates/${templateId}`);
  return { ok: true };
}

/**
 * Assigns a member to a template entry (upsert — safe to call if already assigned).
 * Requires MANAGE_TIMETABLE permission.
 */
export async function addInstanceAssigneeAction(
  orgId: string,
  instanceId: string,
  membershipId: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await addTemplateInstanceAssignee(orgId, instanceId, membershipId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/timetable/templates`);
  return { ok: true };
}

/**
 * Removes a member from a template entry's assignee list.
 * Requires MANAGE_TIMETABLE permission.
 */
export async function removeInstanceAssigneeAction(
  orgId: string,
  instanceId: string,
  membershipId: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await removeTemplateInstanceAssignee(orgId, instanceId, membershipId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/timetable/templates`);
  return { ok: true };
}

/**
 * Counts TimetableEntries in [startDateStr, startDateStr + totalDays) for the given org.
 * Used by the apply-template dialog to warn when existing entries will be replaced.
 */
export async function countTimetableEntriesInRangeAction(
  orgId: string,
  startDateStr: string,
  totalDays: number,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await countTimetableEntriesInRange(orgId, startDateStr, totalDays);
  if (!result.ok) return { ok: false, error: result.error };

  return { ok: true, count: result.data.count };
}

/**
 * Applies a template to the timetable.
 * Deletes ALL existing TimetableEntries in the date range, then creates new
 * ones by projecting the template entries across `cycleRepeats` repetitions
 * starting from `startDateStr` (YYYY-MM-DD) in the org's timezone.
 */
export async function applyTemplateAction(
  orgId: string,
  templateId: string,
  startDateStr: string,
  cycleRepeats: number,
): Promise<{ ok: boolean; error?: string; created?: number }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await applyTemplate(orgId, templateId, startDateStr, cycleRepeats);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/timetable`);
  return { ok: true, created: result.data.created };
}
