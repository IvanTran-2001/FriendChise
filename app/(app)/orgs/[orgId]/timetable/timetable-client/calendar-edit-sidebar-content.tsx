"use client";

/**
 * CalendarEditSidebarContent
 *
 * Sidebar-only editor UI for a single timetable entry (instance).
 *
 * Responsibilities:
 * - Allow members to update an entry's status; managers can also change
 *   schedule, assignees, and delete the entry.
 * - Call server actions (update/delete/add/remove) and surface errors via
 *   the local `error` state.
 * - After successful edits, call `onRefresh()` to let parent refresh data
 *   and then close the sidebar (via `onBack` or `onClose`).
 *
 * Important implementation notes:
 * - This component is a client component and uses optimistic UI flow via
 *   server actions. It avoids polling and relies on `onRefresh()` + the
 *   page's `router.refresh()` to reflect server-side changes.
 * - The past-date confirmation uses a per-browser suppression key so users
 *   may silence the warning for 24 hours.
 */

import { useState, useTransition } from "react";
import { X, Clock, CalendarIcon, Trash2, Check, ChevronLeft } from "lucide-react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { ComboboxItem } from "@/components/ui/searchable-combobox";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  updateTimetableEntryAction,
  updateTimetableEntryStatusAction,
  deleteTimetableEntryAction,
  addTimetableEntryAssigneeAction,
  removeTimetableEntryAssigneeAction,
} from "@/app/actions/timetable-entries";
import { minToHHMM, hhmmToMin } from "../_shared/grid-utils";
import type { ClientTimetableInstance, ClientMembership } from "./types";

type Props = {
  instance: ClientTimetableInstance;
  taskColor?: string;
  memberships: ClientMembership[];
  orgId: string;
  canManage: boolean;
  onClose: () => void;
  onRefresh: () => void;
  router: ReturnType<typeof import("next/navigation").useRouter>;
  todayStr: string;
  onBack?: () => void;
  /** Optional initial values when opening the editor for a proposed move. */
  initialDate?: string;
  initialStartTimeMin?: number;
};

const STATUS_CONFIG: Record<
  ClientTimetableInstance["status"],
  { label: string; bg: string; text: string; ring: string }
> = {
  TODO:        { label: "To Do",      bg: "bg-slate-100 dark:bg-slate-800",   text: "text-slate-600 dark:text-slate-300",  ring: "ring-slate-400" },
  IN_PROGRESS: { label: "In Progress", bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300",  ring: "ring-amber-400" },
  DONE:        { label: "Done",        bg: "bg-green-50 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400",  ring: "ring-green-500" },
  SKIPPED:     { label: "Skipped",     bg: "bg-red-50 dark:bg-red-900/30",     text: "text-red-600 dark:text-red-400",      ring: "ring-red-400"   },
};

export function CalendarEditSidebarContent({
  instance,
  taskColor,
  memberships,
  orgId,
  canManage,
  onClose,
  onRefresh,
  router,
  todayStr,
  onBack,
  initialDate,
  initialStartTimeMin,
}: Props) {
  // Use the proposed move target as the initial form state, but keep the
  // original instance for change detection inside `doSave()`.
  const [startTime, setStartTime] = useState(minToHHMM(initialStartTimeMin ?? instance.startTimeMin));
  const [date, setDate] = useState(initialDate ?? instance.date);
  const [status, setStatus] = useState<ClientTimetableInstance["status"]>(
    instance.status,
  );
  const [localAssignees, setLocalAssignees] = useState(instance.assignees);
  const [pendingAddIds, setPendingAddIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startT] = useTransition();
  const [showPastConfirm, setShowPastConfirm] = useState(false);
  const [suppressSave, setSuppressSave] = useState(false);

  const SUPPRESS_KEY = "timetable-past-edit-warn-suppress";

  function isSuppressed(): boolean {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(SUPPRESS_KEY);
    if (!stored) return false;
    return Date.now() < Number(stored);
  }

  const assignedIds = new Set(localAssignees.map((a) => a.membership.id));
  const available = memberships.filter((m) => !assignedIds.has(m.id));

  const parsedStart = hhmmToMin(startTime);
  const endMin =
    parsedStart == null ? null : parsedStart + instance.task.durationMin;

  function handleSave() {
    if (canManage && date < todayStr && !isSuppressed()) {
      setShowPastConfirm(true);
      return;
    }
    doSave();
  }

  // Persist staged changes to the server.
  // Flow:
  // 1. Flush any staged assignee additions (batched `addTimetableEntryAssigneeAction`).
  // 2. Update the entry: managers can update schedule + status; non-managers only
  //    update the status via `updateTimetableEntryStatusAction`.
  // 3. If the date changed, navigate the page to the new anchor; otherwise call
  //    `onRefresh()` and then close/back out of the sidebar.
  //
  // Note: a small `setTimeout` is used to delay the `onBack`/`onClose` so the
  // router.refresh() can complete and the group list re-fetch can show fresh data.
  // This can be removed once group panels fetch fresh data on mount reliably.
  function doSave() {
    startT(async () => {
      // Flush any staged assignee additions first
      if (pendingAddIds.length > 0) {
        const addResults = await Promise.all(
          pendingAddIds.map((id) =>
            addTimetableEntryAssigneeAction(orgId, instance.id, id),
          ),
        );
        const failed = addResults.find((r) => !r.ok);
        if (failed) {
          setError(failed.error ?? "Failed to add assignee");
          return;
        }
        setPendingAddIds([]);
      }

      const result = canManage
        ? parsedStart == null
          ? { ok: false as const, error: "Invalid start time" }
          : await updateTimetableEntryAction(orgId, instance.id, {
              startTimeMin: parsedStart,
              status,
              dateStr: date !== instance.date ? date : undefined,
            })
        : await updateTimetableEntryStatusAction(orgId, instance.id, status);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }

      if (date !== instance.date) {
        onClose();
        const params = new URLSearchParams(window.location.search);
        const currentMode = params.get("mode") || "calendar";
        const currentSpan = params.get("span") || "week";
        const roleId = params.get("roleId");
        const newParams = new URLSearchParams({
          anchor: date,
          mode: currentMode,
          span: currentSpan,
        });
        if (roleId) newParams.set("roleId", roleId);
        router.push(`/orgs/${orgId}/timetable?${newParams.toString()}`);
      } else {
        onRefresh();
        // Delay returning to the group list so the page can refresh first.
        setTimeout(() => {
          (onBack ?? onClose)();
        }, 300);
      }
    });
  }

  // Delete the current entry on the server and refresh the parent view.
  function handleDelete() {
    startT(async () => {
      const result = await deleteTimetableEntryAction(orgId, instance.id);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      onClose();
      onRefresh();
    });
  }

  // Stage a new assignee locally and enqueue it to be flushed when the
  // user saves the entry. This avoids issuing a network request for every
  // combobox selection and provides immediate local feedback.
  function handleAddAssignee(membershipId: string) {
    const membership = memberships.find((m) => m.id === membershipId);
    if (!membership) return;
    setLocalAssignees((p) => [
      ...p,
      {
        id: `opt-${membershipId}`,
        membership: { ...membership, botName: membership.botName ?? null },
      },
    ]);
    setPendingAddIds((p) => [...p, membershipId]);
  }

  // Remove an assignee. If the assignee was only staged locally (pendingAddIds),
  // just drop it locally. Otherwise, remove it on the server immediately.
  function handleRemoveAssignee(membershipId: string) {
    // If this assignee was staged but not yet saved, just drop locally
    if (pendingAddIds.includes(membershipId)) {
      setLocalAssignees((p) => p.filter((a) => a.membership.id !== membershipId));
      setPendingAddIds((p) => p.filter((id) => id !== membershipId));
      return;
    }
    // Otherwise remove from server immediately
    startT(async () => {
      const r = await removeTimetableEntryAssigneeAction(
        orgId,
        instance.id,
        membershipId,
      );
      if (!r.ok) {
        setError(r.error ?? "Failed to remove assignee");
        return;
      }
      setLocalAssignees((p) =>
        p.filter((a) => a.membership.id !== membershipId),
      );
      onRefresh();
    });
  }

  return (
    <>
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex flex-col gap-5 p-4">

          {/* ── Back button ───────────────────────────────────────────── */}
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors -mb-2 self-start"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}

          {/* ── Task meta ─────────────────────────────────────────────── */}
          <div
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 border"
            style={{
              borderLeftColor: taskColor ?? instance.taskColor ?? "#9ca3af",
              borderLeftWidth: 3,
            }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-snug truncate">
                {instance.task.title}
              </p>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                {minToHHMM(instance.startTimeMin)}–
                {minToHHMM(instance.startTimeMin + instance.task.durationMin)}
                <span className="ml-1.5 opacity-60">· {instance.task.durationMin} min</span>
              </p>
            </div>
          </div>

          {/* ── Status ────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Status
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(STATUS_CONFIG) as ClientTimetableInstance["status"][]).map((s) => {
                const cfg = STATUS_CONFIG[s];
                const active = status === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${cfg.bg} ${cfg.text} ${active ? `ring-2 ${cfg.ring}` : "opacity-60 hover:opacity-90"}`}
                  >
                    {active && <Check className="h-3 w-3 shrink-0" />}
                    {!active && <span className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Date & Time (manager only) ─────────────────────────── */}
          {canManage && (
            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Schedule
              </label>

              {/* Date */}
              <div className="flex items-center gap-2.5 rounded-lg border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring/50">
                <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>

              {/* Start time */}
              <div className="flex items-center gap-2.5 rounded-lg border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring/50">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
                <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                  →&nbsp;{endMin == null ? "--:--" : minToHHMM(endMin)}
                </span>
              </div>
            </div>
          )}

          {/* ── Assignees (manager only) ───────────────────────────── */}
          {canManage && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Assignees
              </label>

              {available.length > 0 && (
                <SearchableCombobox
                  items={available.map((m): ComboboxItem => ({
                    id: m.id,
                    name: m.user?.name ?? m.botName ?? "Bot",
                  }))}
                  onSelect={(item) => handleAddAssignee(item.id)}
                  triggerLabel="Add assignee…"
                  placeholder="Search members…"
                  disabled={isSaving}
                />
              )}

              <div className="flex flex-col gap-1">
                {localAssignees.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No one assigned</p>
                )}
                {localAssignees.map((a) => {
                  const name = a.membership.user?.name ?? a.membership.botName ?? "Bot";
                  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={a.membership.id}
                      className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                        {initials}
                      </div>
                      <span className="flex-1 text-sm truncate">{name}</span>
                      <button
                        onClick={() => handleRemoveAssignee(a.membership.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        aria-label={`Remove ${name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* ── Action bar ────────────────────────────────────────────── */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleSave}
              disabled={(canManage && parsedStart == null) || isSaving}
              className="flex-1 h-9"
            >
              {isSaving ? "Saving…" : "Save"}
            </Button>
            {canManage && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleDelete}
                disabled={isSaving}
                className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                aria-label="Delete entry"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Past-date confirmation */}
      <AlertDialog
        open={showPastConfirm}
        onOpenChange={(open) => {
          if (!open) setShowPastConfirm(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save to a past date?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{date}</strong> is in the past. Are you sure you want to
              save this entry here?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none px-1 pb-1">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary rounded"
              checked={suppressSave}
              onChange={(e) => setSuppressSave(e.target.checked)}
            />
            Don&apos;t warn me again for 24 hours
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowPastConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (suppressSave) {
                  localStorage.setItem(
                    SUPPRESS_KEY,
                    String(Date.now() + 24 * 60 * 60 * 1000),
                  );
                }
                setShowPastConfirm(false);
                setSuppressSave(false);
                doSave();
              }}
            >
              Save Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
