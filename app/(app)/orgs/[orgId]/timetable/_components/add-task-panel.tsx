"use client";

import { useState, useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskPanel } from "../_shared/task-panel";
import { createTimetableEntryAction } from "@/app/actions/timetable-entries";
import type { SharedTask } from "../_shared/types";

interface AddTaskPanelProps {
  tasks: SharedTask[];
  orgId: string;
  /** Default date shown in the schedule form (current view anchor). */
  anchor: string;
  todayStr: string;
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
}: AddTaskPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "schedule">("list");
  const [selectedTask, setSelectedTask] = useState<SharedTask | null>(null);
  const [date, setDate] = useState(anchor >= todayStr ? anchor : todayStr);
  const [timeStr, setTimeStr] = useState("09:00");
  const [isPending, startTransition] = useTransition();

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
      <div className="flex flex-col gap-4 p-4">
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
    <TaskPanel
      tasks={tasks}
      onDragStart={(taskId, e) => {
        e.dataTransfer.setData("timetable/taskId", taskId);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDragEnd={() => {}}
      onTaskClick={handleTaskClick}
    />
  );
}
