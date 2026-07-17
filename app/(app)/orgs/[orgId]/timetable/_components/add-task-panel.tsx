"use client";

import { useState, useTransition, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskPanel } from "../_shared/task-panel";
import { getDragHandlers } from "../_shared/drag-registry";
import { createTimetableEntryAction } from "@/app/actions/timetable-entries";
import type { SharedTask } from "../_shared/types";

interface AddTaskPanelProps {
  tasks: SharedTask[];
  orgId: string;
  /** Default date shown in the schedule form (current view anchor). */
  anchor: string;
  todayStr: string;
  /** Optional initial state when opened from a drop */
  initialMode?: "list" | "schedule";
  initialTaskId?: string;
  initialDate?: string;
  initialTimeStr?: string;
  onClose?: () => void;
}

/**
 * Two-mode panel for adding tasks to the timetable.
 *
 * - "list" mode  — searchable, draggable task list; clicking a task opens the form.
 * - "schedule" mode — date + time pickers; submits via createTimetableEntryAction.
 *
 * Designed to render inside ActionSidebarSlot. Drag events set
 * `dataTransfer` so TimeGrid can pick them up as task drops.
 */
export function AddTaskPanel({
  tasks,
  orgId,
  anchor,
  todayStr,
  initialMode,
  initialTaskId,
  initialDate,
  initialTimeStr,
  onClose,
}: AddTaskPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "schedule">(initialMode ?? "list");
  const [selectedTask, setSelectedTask] = useState<SharedTask | null>(
    initialTaskId ? tasks.find((t) => t.id === initialTaskId) ?? null : null,
  );
  const [date, setDate] = useState(initialDate ?? (anchor >= todayStr ? anchor : todayStr));
  const [timeStr, setTimeStr] = useState(initialTimeStr ?? "09:00");
  const [isPending, startTransition] = useTransition();

  function loadTasks(search: string, cursor: string | null | undefined, signal: AbortSignal) {
    const params = new URLSearchParams();
    params.set("mode", "list");
    params.set("limit", "20");
    params.set("sort", "name-asc");
    if (search.trim()) params.set("search", search.trim());
    if (cursor) params.set("cursor", cursor);

    return fetch(`/api/orgs/${orgId}/tasks/paginated?${params.toString()}`, { signal }).then(
      async (response) => {
        if (!response.ok) throw new Error("Failed to load tasks.");
        const data = (await response.json()) as {
          tasks: Array<{
            id: string;
            name: string;
            durationMin: number;
            color?: string | null;
            eligibility?: Array<{ role?: { name: string; color: string | null } | null }>;
          }>;
          nextCursor: string | null;
        };
        return {
          tasks: data.tasks.map((task) => ({
            id: task.id,
            name: task.name,
            durationMin: task.durationMin,
            color: task.color ?? null,
            roleColor: task.eligibility?.[0]?.role?.color ?? null,
            roleName: task.eligibility?.[0]?.role?.name ?? null,
          })),
          nextCursor: data.nextCursor,
        };
      },
    );
  }

  useEffect(() => {
    return () => {
      onClose?.();
    };
  }, [onClose]);

  function handleTaskClick(task: SharedTask) {
    setSelectedTask(task);
    setMode("schedule");
  }

  function handleBack() {
    setMode("list");
    setSelectedTask(null);
  }

  function handleSubmit() {
    if (!selectedTask) return;
    if (!date) {
      toast.error("Please select a date.");
      return;
    }
    const [hours, minutes] = timeStr.split(":").map(Number);

    // Validate parsed time values
    if (
      isNaN(hours) ||
      isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      toast.error("Invalid time format. Please enter a valid time.");
      return;
    }

    const startTimeMin = hours * 60 + minutes;
    startTransition(async () => {
      try {
        const result = await createTimetableEntryAction(
          orgId,
          selectedTask.id,
          date,
          startTimeMin,
        );
        if (!result.ok) {
          toast.error(result.error ?? "Something went wrong");
          return;
        }
        window.dispatchEvent(
          new CustomEvent("friendchise:timetable-entry-created", {
            detail: {
              orgId,
              taskId: selectedTask.id,
              date,
              startTimeMin,
              source: "panel",
            },
          }),
        );
        router.refresh();
        setMode("list");
        setSelectedTask(null);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  // ── Schedule form ────────────────────────────────────────────────────────
  if (mode === "schedule" && selectedTask) {
    return (
      <div className="flex flex-col gap-4 p-4" data-tour-target="add-task-panel">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -mx-1 px-1 py-0.5 rounded w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to tasks
        </button>

        {/* Selected task card */}
        <div className="rounded-lg border bg-card px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span
              className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
              style={{
                backgroundColor:
                  selectedTask.roleColor ?? selectedTask.color ?? "#9ca3af",
              }}
            />
            <div>
              <p className="text-sm font-semibold leading-snug">
                {selectedTask.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedTask.roleName ? `${selectedTask.roleName} · ` : ""}
                {selectedTask.durationMin} min
              </p>
            </div>
          </div>
        </div>

        {/* Date + time inputs */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="date-input"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Date
            </label>
            <Input
              id="date-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="start-time-input"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Start time
            </label>
            <Input
              id="start-time-input"
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={isPending} size="sm">
          {isPending ? "Adding…" : "Add to timetable"}
        </Button>
      </div>
    );
  }

  // ── Task list ────────────────────────────────────────────────────────────
  return (
    <div data-tour-target="add-task-panel">
      <TaskPanel
        tasks={[]}
        loadTasks={loadTasks}
        onDragStart={(taskId, e) => {
          const h = getDragHandlers();
          h.setIsDragging?.(true);
          e.dataTransfer.setData("timetable/taskId", taskId);
          e.dataTransfer.effectAllowed = "copy";
        }}
        onDragEnd={() => {
          const h = getDragHandlers();
          h.setIsDragging?.(false);
        }}
        onTaskClick={handleTaskClick}
      />
    </div>
  );
}
