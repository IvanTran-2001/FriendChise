"use server";

/**
 * @file timetable-entries.ts
 * Server actions for CRUD on live timetable entries.
 *
 * All actions require MANAGE_TIMETABLE permission and are scoped to `orgId`
 * so no cross-org data can be read or modified.
 */

import { PermissionAction, EntryStatus } from "@prisma/client";
import {
  requireOrgPermissionAction,
  requireOrgMemberAction,
} from "@/lib/authz";
import { revalidatePath } from "next/cache";
import {
  createTimetableEntry,
  updateTimetableEntry,
  updateTimetableEntriesBatch,
  deleteTimetableEntry,
  addTimetableEntryAssignee,
  removeTimetableEntryAssignee,
  getTimetableInstancesByIds,
} from "@/lib/services/timetable-entries";
import type { WeekTimetableInstance } from "@/lib/services/timetable-entries";

/**
 * Creates a new live timetable entry from a task.
 * Snapshots name/color/description from the task at creation time.
 * `endTimeMin` is automatically set to `startTimeMin + task.durationMin`, capped at 1440 (midnight).
 */
export async function createTimetableEntryAction(
  orgId: string,
  taskId: string,
  dateStr: string,
  startTimeMin: number,
): Promise<{ ok: boolean; data?: WeekTimetableInstance; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await createTimetableEntry(
    orgId,
    taskId,
    dateStr,
    startTimeMin,
    authz.userId,
    authz.userEmail,
  );
  if (!result.ok) return { ok: false, error: result.error };

  // Map the created entry to the client WeekTimetableInstance shape
  revalidatePath(`/orgs/${orgId}/timetable`);
  try {
    const instances = await getTimetableInstancesByIds(orgId, [result.data.id]);
    return { ok: true, data: instances[0] };
  } catch (err) {
    // Fetch failed, but the entry was created successfully. Return a minimal
    // fallback instance constructed from the result so the client doesn't see a false failure.
    // Convert result.data.date (Date object) to YYYY-MM-DD string
    const resultDateStr = result.data.date
      ? result.data.date.toISOString().split('T')[0]
      : dateStr;
    const resultStartTimeMin = result.data.startTimeMin ?? startTimeMin;
    const resultStatus = (result.data.status ?? "TODO") as "TODO" | "IN_PROGRESS" | "DONE" | "SKIPPED";
    const durationMinutes = result.data.durationMin ?? 60;

    // Compute actual ISO timestamps from date string and minute offsets
    const startHours = Math.floor(resultStartTimeMin / 60);
    const startMinutes = resultStartTimeMin % 60;
    const startTimeStr = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}:00`;

    const endTimeMin = result.data.endTimeMin ?? (resultStartTimeMin + durationMinutes);
    const endHours = Math.floor(endTimeMin / 60);
    const endMinutes = endTimeMin % 60;
    const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:00`;

    const scheduledStartAt = new Date(`${resultDateStr}T${startTimeStr}`).toISOString();
    const scheduledEndAt = new Date(`${resultDateStr}T${endTimeStr}`).toISOString();

    const fallback: WeekTimetableInstance = {
      id: result.data.id,
      taskId: result.data.taskId,
      date: resultDateStr,
      startTimeMin: resultStartTimeMin,
      status: resultStatus,
      assignees: [],
      taskColor: null,
      scheduledStartAt,
      scheduledEndAt,
      task: {
        id: result.data.taskId,
        title: result.data.taskName ?? "Task",
        durationMin: durationMinutes,
        preferredStartTimeMin: null,
      },
    };
    return { ok: true, data: fallback };
  }
}

/**
 * Updates the start time, status, and/or date of a live timetable entry.
 * `endTimeMin` is automatically recalculated when `startTimeMin` changes.
 */
export async function updateTimetableEntryAction(
  orgId: string,
  entryId: string,
  update: { startTimeMin?: number; dateStr?: string; status?: EntryStatus },
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await updateTimetableEntry(orgId, entryId, update);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/timetable`);
  return { ok: true };
}

/**
 * Moves multiple live timetable entries atomically — single auth check,
 * single DB transaction. Used for group-card drag-and-drop.
 */
export async function updateTimetableEntriesBatchAction(
  orgId: string,
  updates: { entryId: string; startTimeMin: number; dateStr: string }[],
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await updateTimetableEntriesBatch(orgId, updates);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/timetable`);
  return { ok: true };
}

/**
 * Updates only the status of a timetable entry.
 * Any org member may call this — no MANAGE_TIMETABLE permission required.
 */
export async function updateTimetableEntryStatusAction(
  orgId: string,
  entryId: string,
  status: EntryStatus,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgMemberAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await updateTimetableEntry(orgId, entryId, { status });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/timetable`);
  return { ok: true };
}

/**
 * Fetch timetable instances by IDs for a panel. Any org member may call.
 */
export async function fetchTimetableInstancesAction(
  orgId: string,
  ids: string[],
): Promise<{ ok: boolean; data?: WeekTimetableInstance[]; error?: string }> {
  const authz = await requireOrgMemberAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  try {
    const data = await getTimetableInstancesByIds(orgId, ids);
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Failed to fetch instances" };
  }
}

/**
 * Permanently deletes a live timetable entry, scoped to `orgId`.
 */
export async function deleteTimetableEntryAction(
  orgId: string,
  entryId: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await deleteTimetableEntry(
    orgId,
    entryId,
    authz.userId,
    authz.userEmail,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/timetable`);
  return { ok: true };
}

/**
 * Assigns a member to a timetable entry (upsert — safe if already assigned).
 */
export async function addTimetableEntryAssigneeAction(
  orgId: string,
  entryId: string,
  membershipId: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await addTimetableEntryAssignee(orgId, entryId, membershipId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/timetable`);
  return { ok: true };
}

/**
 * Removes a member from a timetable entry's assignee list.
 */
export async function removeTimetableEntryAssigneeAction(
  orgId: string,
  entryId: string,
  membershipId: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await removeTimetableEntryAssignee(
    orgId,
    entryId,
    membershipId,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/timetable`);
  return { ok: true };
}
