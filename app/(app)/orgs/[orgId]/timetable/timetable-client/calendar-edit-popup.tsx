"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { useIsMobile } from "@/hooks/use-mobile";
import {
  updateTimetableEntryAction,
  updateTimetableEntryStatusAction,
  deleteTimetableEntryAction,
  addTimetableEntryAssigneeAction,
  removeTimetableEntryAssigneeAction,
} from "@/app/actions/timetable-entries";
import { minToHHMM, hhmmToMin } from "../_shared/grid-utils";
import type { ClientTimetableInstance, ClientMembership } from "./types";

// ---------------------------------------------------------------------------
// CalendarEditPopup
// ---------------------------------------------------------------------------

/**
 * Props for CalendarEditPopup.
 *
 * - `open`       — Controlled open state; the parent keeps an `editingInstance`
 *                  state and passes `open={!!editingInstance}`.
 * - `canManage`  — When `true`, shows full edit controls (time/date, assignees,
 *                  delete). When `false`, shows status-only controls.
 * - `onClose`    — Called when the dialog should dismiss (Escape, overlay click,
 *                  or successful save). Parent clears `editingInstance`.
 * - `onRefresh`  — Called after a successful mutation to trigger a server
 *                  re-render via `router.refresh()`.
 */
interface CalendarEditPopupProps {
  instance: ClientTimetableInstance;
  memberships: ClientMembership[];
  orgId: string;
  canManage: boolean;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  router: ReturnType<typeof useRouter>;
  todayStr: string;
}

export function CalendarEditPopup({
  instance,
  memberships,
  orgId,
  canManage,
  open,
  onClose,
  onRefresh,
  router,
  todayStr,
}: CalendarEditPopupProps) {
  const [startTime, setStartTime] = useState(minToHHMM(instance.startTimeMin));
  const [date, setDate] = useState(instance.date);
  const [status, setStatus] = useState<ClientTimetableInstance["status"]>(
    instance.status,
  );
  const [localAssignees, setLocalAssignees] = useState(instance.assignees);
  const [addMembershipId, setAddMembershipId] = useState("");
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
  const effectiveAddId = available.find((m) => m.id === addMembershipId)
    ? addMembershipId
    : (available[0]?.id ?? "");

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

  function doSave() {
    startT(async () => {
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
      onClose();

      // If the date has changed, navigate to the week containing the new date
      if (date !== instance.date) {
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
        // Only refresh if the date has NOT changed
        onRefresh();
      }
    });
  }

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

  function handleAddAssignee() {
    const membership = memberships.find((m) => m.id === effectiveAddId);
    if (!membership) return;
    startT(async () => {
      const r = await addTimetableEntryAssigneeAction(
        orgId,
        instance.id,
        effectiveAddId,
      );
      if (!r.ok) {
        setError(r.error ?? "Failed to add assignee");
        return;
      }
      setLocalAssignees((p) => [
        ...p,
        { id: `opt-${effectiveAddId}`, membership },
      ]);
      onRefresh();
    });
  }

  function handleRemoveAssignee(membershipId: string) {
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

  const isMobile = useIsMobile();

  const pastConfirmDialog = (
    <AlertDialog
      open={showPastConfirm}
      onOpenChange={(open) => { if (!open) setShowPastConfirm(false); }}
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
                localStorage.setItem(SUPPRESS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
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
  );

  const popupContent = (
    <div className="flex flex-col gap-3 p-4">
      {/* Status — always shown first so it's the primary action (#76) */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">
          Status
        </label>
        <select
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as ClientTimetableInstance["status"])
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          autoFocus
        >
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="DONE">Done</option>
          <option value="SKIPPED">Skipped</option>
        </select>
      </div>

      {canManage && (
        <>
          {/* Date picker (#70) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">
              Date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 w-full text-sm"
            />
          </div>

          {/* Time */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">
              Start time
            </label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-8 w-32 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {startTime} → {endMin == null ? "--:--" : minToHHMM(endMin)} ·{" "}
              {instance.task.durationMin} min
            </p>
          </div>
        </>
      )}

      {canManage && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">
            Assign
          </label>
          {localAssignees.length === 0 && (
            <span className="text-xs text-muted-foreground italic">
              No one assigned
            </span>
          )}
          <div className="flex flex-col gap-1">
            {localAssignees.map((a) => (
              <div
                key={a.membership.id}
                className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-xs"
              >
                <span>{a.membership.user?.name ?? a.membership.botName ?? "Bot"}</span>
                <button
                  onClick={() => handleRemoveAssignee(a.membership.id)}
                  className="text-muted-foreground hover:text-destructive ml-2"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          {available.length > 0 && (
            <div className="flex gap-1 items-center mt-0.5">
              <select
                value={effectiveAddId}
                onChange={(e) => setAddMembershipId(e.target.value)}
                className="flex-1 border rounded px-2 py-1 text-xs bg-background"
              >
                {available.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.user?.name ?? m.botName ?? "Bot"}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddAssignee}
                className="h-7 w-7 p-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1 border-t">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={(canManage && parsedStart == null) || isSaving}
          className="flex-1 h-7"
        >
          {isSaving ? "Saving…" : "Save"}
        </Button>
        {canManage && (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={isSaving}
            className="h-7"
          >
            Delete
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          disabled={isSaving}
          className="h-7"
        >
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <Sheet
          open={open}
          onOpenChange={(o) => {
            if (!o) onClose();
          }}
        >
          <SheetContent
            side="bottom"
            className="h-[calc(100dvh-4rem)] p-0 flex flex-col rounded-t-2xl overflow-hidden"
          >
            <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
              <SheetTitle>{instance.task.title}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">{popupContent}</div>
          </SheetContent>
        </Sheet>
        {pastConfirmDialog}
      </>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      >
        <DialogContent
          className="w-72 p-0 gap-0 overflow-hidden"
          showCloseButton={false}
        >
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>{instance.task.title}</DialogTitle>
          </DialogHeader>
          {popupContent}
        </DialogContent>
      </Dialog>
      {pastConfirmDialog}
    </>
  );
}