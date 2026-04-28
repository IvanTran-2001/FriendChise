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
  deleteTimetableEntry,
  addTimetableEntryAssignee,
  removeTimetableEntryAssignee,
} from "@/lib/services/timetable-entries";

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
): Promise<{ ok: boolean; error?: string }> {
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
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/timetable`);
  return { ok: true };
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

  const result = await deleteTimetableEntry(orgId, entryId, authz.userId);
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
