"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addTemplateInstanceAction,
  removeTemplateInstanceAction,
  updateTemplateInstanceAction,
  updateTemplateDaysAction,
  addInstanceAssigneeAction,
  removeInstanceAssigneeAction,
} from "@/app/actions/templates";
import { TimeGrid } from "../../_shared/time-grid";
import type { DragDataRef } from "../../_shared/time-grid";
import { TaskPanel } from "../../_shared/task-panel";
import { minToHHMM, hhmmToMin } from "../../_shared/grid-utils";
import type { SharedTask, SharedMembership } from "../../_shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientTemplateInstance = {
  id: string;
  dayIndex: number;
  startTimeMin: number;
  task: { id: string; name: string; durationMin: number };
  assignees: Array<{
    id: string;
    membership: { id: string; user: { id: string; name: string | null } };
  }>;
};

export type ClientTask = SharedTask;
export type ClientMembership = SharedMembership;

// ---------------------------------------------------------------------------
// EditPopup (template-specific: no status field)
// ---------------------------------------------------------------------------

interface EditPopupProps {
  instance: ClientTemplateInstance;
  memberships: ClientMembership[];
  orgId: string;
  onSave: (startTimeMin: number) => void;
  onRemove: () => void;
  onClose: () => void;
}

function EditPopup({
  instance,
  memberships,
  orgId,
  onSave,
  onRemove,
  onClose,
}: EditPopupProps) {
  const router = useRouter();
  const [startTime, setStartTime] = useState(minToHHMM(instance.startTimeMin));
  const [localAssignees, setLocalAssignees] = useState(instance.assignees);
  const [addMembershipId, setAddMembershipId] = useState("");
  const [, startT] = useTransition();

  const assignedIds = new Set(localAssignees.map((a) => a.membership.id));
  const available = memberships.filter((m) => !assignedIds.has(m.id));
  const effectiveAddId = available.find((m) => m.id === addMembershipId)
    ? addMembershipId
    : (available[0]?.id ?? "");

  const parsedStartTime = hhmmToMin(startTime);
  const endMin =
    parsedStartTime == null
      ? null
      : parsedStartTime + instance.task.durationMin;

  function handleAddAssignee() {
    const membership = memberships.find((m) => m.id === effectiveAddId);
    if (!membership) return;
    startT(async () => {
      const r = await addInstanceAssigneeAction(
        orgId,
        instance.id,
        effectiveAddId,
      );
      if (r.ok) {
        setLocalAssignees((p) => [
          ...p,
          { id: `opt-${effectiveAddId}`, membership },
        ]);
        router.refresh();
      }
    });
  }

  function handleRemoveAssignee(membershipId: string) {
    startT(async () => {
      const r = await removeInstanceAssigneeAction(
        orgId,
        instance.id,
        membershipId,
      );
      if (r.ok) {
        setLocalAssignees((p) =>
          p.filter((a) => a.membership.id !== membershipId),
        );
        router.refresh();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={onClose}
    >
      <div
        className="bg-background rounded-xl border shadow-2xl w-72 p-4 flex flex-col gap-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <span className="font-semibold">{instance.task.name}</span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

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
                <span>{a.membership.user.name ?? "Unknown"}</span>
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
                    {m.user.name ?? "Unknown"}
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

        <div className="flex gap-2 pt-1 border-t">
          <Button
            size="sm"
            onClick={() => parsedStartTime != null && onSave(parsedStartTime)}
            disabled={parsedStartTime == null}
            className="flex-1 h-7"
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onRemove}
            className="h-7"
          >
            Remove
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

const DAYS_PER_PAGE = 7;

interface TemplateEditorClientProps {
  orgId: string;
  templateId: string;
  templateDays: number;
  instances: ClientTemplateInstance[];
  availableTasks: ClientTask[];
  memberships: ClientMembership[];
  openTimeMin: number;
  closeTimeMin: number;
  fillHeight?: boolean;
}

export function TemplateEditorClient({
  orgId,
  templateId,
  templateDays,
  instances,
  availableTasks,
  memberships,
  openTimeMin,
  closeTimeMin,
  fillHeight,
}: TemplateEditorClientProps) {
  const router = useRouter();
  const [, startT] = useTransition();

  const totalPages = Math.ceil(templateDays / DAYS_PER_PAGE);
  const [page, setPage] = useState(0);
  const pageStart = page * DAYS_PER_PAGE;
  const pageEnd = Math.min(pageStart + DAYS_PER_PAGE, templateDays);
  const visibleDays = Array.from(
    { length: pageEnd - pageStart },
    (_, i) => pageStart + i,
  );
  const columns = visibleDays.map(String);

  type DragData =
    | { type: "task"; taskId: string }
    | { type: "move"; instanceId: string; offsetMin: number };
  const dragDataRef = useRef<DragData | null>(null);
  const [dragOver, setDragOver] = useState<{
    column: string;
    timeMin: number;
  } | null>(null);
  const [editingInstance, setEditingInstance] =
    useState<ClientTemplateInstance | null>(null);

  function handleAddDay() {
    startT(async () => {
      await updateTemplateDaysAction(orgId, templateId, templateDays + 1);
      router.refresh();
    });
  }

  function handleRemoveDay() {
    if (templateDays <= 1) return;
    startT(async () => {
      await updateTemplateDaysAction(orgId, templateId, templateDays - 1);
      const newPages = Math.ceil((templateDays - 1) / DAYS_PER_PAGE);
      if (page >= newPages) setPage(Math.max(0, newPages - 1));
      router.refresh();
    });
  }

  let initialScrollMin = openTimeMin;
  for (const inst of instances) {
    if (inst.startTimeMin < initialScrollMin)
      initialScrollMin = inst.startTimeMin;
  }

  function handleDrop(col: string, timeMin: number, data: DragData) {
    const day = parseInt(col, 10);
    startT(async () => {
      const result =
        data.type === "task"
          ? await addTemplateInstanceAction(
              orgId,
              templateId,
              data.taskId,
              day,
              timeMin,
            )
          : await updateTemplateInstanceAction(orgId, data.instanceId, {
              dayIndex: day,
              startTimeMin: timeMin,
            });
      if (!result.ok) return;
      router.refresh();
    });
  }

  function handleEditSave(startTimeMin: number) {
    if (!editingInstance) return;
    startT(async () => {
      const result = await updateTemplateInstanceAction(
        orgId,
        editingInstance.id,
        { startTimeMin },
      );
      if (!result.ok) return;
      setEditingInstance(null);
      router.refresh();
    });
  }

  function handleEditRemove() {
    if (!editingInstance) return;
    startT(async () => {
      const result = await removeTemplateInstanceAction(
        orgId,
        editingInstance.id,
      );
      if (!result.ok) return;
      setEditingInstance(null);
      router.refresh();
    });
  }

  return (
    <div
      className={
        fillHeight ? "flex flex-col flex-1 min-h-0" : "flex flex-col gap-4"
      }
    >
      <div className={`flex gap-4${fillHeight ? " flex-1 min-h-0" : ""}`}>
        {/* \u2500\u2500 Left: nav + grid \u2500\u2500 */}
        <div
          className={`flex-1 min-w-0 flex flex-col gap-3${fillHeight ? " min-h-0" : ""}`}
        >
          {/* Cycle navigation */}
          <div className="flex items-center justify-between rounded-lg border bg-card shadow-sm px-4 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              ◄ Prev
            </Button>
            <span className="text-sm font-medium">
              Cycle: {templateDays} Day{templateDays !== 1 ? "s" : ""}, Day{" "}
              {pageStart + 1}–{pageEnd}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Next ►
            </Button>
          </div>

          <TimeGrid
            columns={columns}
            instances={instances.filter((inst) =>
              visibleDays.includes(inst.dayIndex),
            )}
            getColumnKey={(inst) => String(inst.dayIndex)}
            renderColumnHeader={(col) => (
              <>
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Day
                </div>
                <div className="text-base font-bold leading-none mt-0.5">
                  {parseInt(col, 10) + 1}
                </div>
              </>
            )}
            renderBlock={(inst, heightPx) => (
              <>
                <div className="font-semibold truncate">{inst.task.name}</div>
                {heightPx >= 32 && (
                  <div className="opacity-70 text-[10px]">
                    {minToHHMM(inst.startTimeMin)}
                  </div>
                )}
                {heightPx >= 48 && inst.assignees.length > 0 && (
                  <div className="opacity-70 text-[10px] truncate">
                    {inst.assignees
                      .map((a) => a.membership.user.name?.split(" ")[0])
                      .join(", ")}
                  </div>
                )}
              </>
            )}
            dragDataRef={dragDataRef as DragDataRef}
            onDragOver={(col, timeMin) => setDragOver({ column: col, timeMin })}
            onDrop={handleDrop}
            onDragLeave={() => setDragOver(null)}
            dragOver={dragOver}
            onBlockMenuClick={setEditingInstance}
            draggable
            initialScrollMin={initialScrollMin}
            openTimeMin={openTimeMin}
            closeTimeMin={closeTimeMin}
            fillHeight={fillHeight}
          />
        </div>

        {/* \u2500\u2500 Right panel \u2500\u2500 */}
        <div
          className={`w-56 shrink-0 flex flex-col gap-3${fillHeight ? " min-h-0" : ""}`}
        >
          <div className="rounded-xl border bg-card shadow-sm p-3 flex flex-col gap-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Cycle
            </div>
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-2"
              onClick={handleAddDay}
            >
              <Plus className="h-3.5 w-3.5" /> Add Day
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-2"
              onClick={handleRemoveDay}
              disabled={templateDays <= 1}
            >
              <Minus className="h-3.5 w-3.5" /> Remove Day
            </Button>
          </div>

          <TaskPanel
            tasks={availableTasks}
            fillHeight={fillHeight}
            onDragStart={(taskId, e) => {
              dragDataRef.current = { type: "task", taskId };
              e.dataTransfer.effectAllowed = "copy";
            }}
            onDragEnd={() => {
              dragDataRef.current = null;
              setDragOver(null);
            }}
          />
        </div>
      </div>

      {editingInstance && (
        <EditPopup
          instance={editingInstance}
          memberships={memberships}
          orgId={orgId}
          onSave={handleEditSave}
          onRemove={handleEditRemove}
          onClose={() => setEditingInstance(null)}
        />
      )}
    </div>
  );
}
