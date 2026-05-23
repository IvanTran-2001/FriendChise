/**
 * @file app/actions/roster.ts
 * Server actions for the Roster tool.
 * All write actions require MANAGE_TIMETABLE permission.
 * Thin wrappers: validate auth → delegate to lib/services/roster → revalidatePath.
 */
"use server";

import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionAction } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import {
  setRosterCellMembers,
  upsertRosterDayConfig,
  createRosterTemplate,
  deleteRosterTemplate,
  renameRosterTemplate,
  setRosterTemplateCellMembers,
  updateRosterTemplateCycleWeeks,
  clearRosterTemplateWeek,
  applyRosterTemplate,
  type RosterCellMember,
  type RosterTemplateCellMember,
  type SavedRosterEntry,
} from "@/lib/services/roster";

function rosterPath(orgId: string) {
  return `/orgs/${orgId}/tools/roster`;
}
function rosterTemplatesPath(orgId: string) {
  return `/orgs/${orgId}/tools/roster/templates`;
}
function rosterTemplateEditorPath(orgId: string, templateId: string) {
  return `/orgs/${orgId}/tools/roster/templates/${templateId}`;
}

export async function setRosterCellMembersAction(
  orgId: string,
  weekStart: Date,
  dayIndex: number,
  members: RosterCellMember[],
): Promise<{ ok: boolean; error?: string; entries?: SavedRosterEntry[] }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await setRosterCellMembers(orgId, weekStart, dayIndex, members);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(rosterPath(orgId));
  return { ok: true, entries: result.data };
}

export async function upsertRosterDayConfigAction(
  orgId: string,
  dayIndex: number,
  data: {
    recommendedSize?: number;
    openTimeMin?: number | null;
    closeTimeMin?: number | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await upsertRosterDayConfig(orgId, dayIndex, data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(rosterPath(orgId));
  return { ok: true };
}

// ─── Template actions ──────────────────────────────────────────────────────────

export async function createRosterTemplateAction(
  orgId: string,
  name: string,
  cycleWeeks: number = 1,
): Promise<{ ok: boolean; error?: string; templateId?: string }> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TIMETABLE);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await createRosterTemplate(orgId, name, cycleWeeks);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(rosterTemplatesPath(orgId));
  return { ok: true, templateId: result.data.id };
}

export async function deleteRosterTemplateAction(
  orgId: string,
  templateId: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TIMETABLE);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await deleteRosterTemplate(orgId, templateId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(rosterTemplatesPath(orgId));
  return { ok: true };
}

export async function renameRosterTemplateAction(
  orgId: string,
  templateId: string,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TIMETABLE);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await renameRosterTemplate(orgId, templateId, name);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(rosterTemplateEditorPath(orgId, templateId));
  return { ok: true };
}

export async function setRosterTemplateCellMembersAction(
  orgId: string,
  templateId: string,
  weekIndex: number,
  dayIndex: number,
  members: RosterTemplateCellMember[],
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TIMETABLE);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await setRosterTemplateCellMembers(orgId, templateId, weekIndex, dayIndex, members);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(rosterTemplateEditorPath(orgId, templateId));
  return { ok: true };
}

export async function updateRosterTemplateCycleWeeksAction(
  orgId: string,
  templateId: string,
  cycleWeeks: number,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TIMETABLE);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await updateRosterTemplateCycleWeeks(orgId, templateId, cycleWeeks);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(rosterTemplateEditorPath(orgId, templateId));
  return { ok: true };
}

export async function clearRosterTemplateWeekAction(
  orgId: string,
  templateId: string,
  weekIndex: number,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TIMETABLE);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await clearRosterTemplateWeek(orgId, templateId, weekIndex);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(rosterTemplateEditorPath(orgId, templateId));
  return { ok: true };
}

export async function applyRosterTemplateAction(
  orgId: string,
  templateId: string,
  startDateStr: string,
  cycleRepeats: number,
  force: boolean,
): Promise<{ ok: boolean; error?: string; conflict?: boolean }> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TIMETABLE);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const parsed = new Date(startDateStr + "T00:00:00Z");
  if (isNaN(parsed.getTime())) return { ok: false, error: "Invalid date" };
  const day = parsed.getUTCDay();
  const prev = 1 - day;
  const next = prev + 7;
  const diff = Math.abs(prev) <= Math.abs(next) ? prev : next;
  parsed.setUTCDate(parsed.getUTCDate() + diff);

  const result = await applyRosterTemplate(orgId, templateId, parsed, cycleRepeats, force);
  if (!result.ok) {
    if (result.code === "CONFLICT") return { ok: false, conflict: true };
    return { ok: false, error: result.error };
  }

  revalidatePath(rosterPath(orgId));
  return { ok: true };
}
