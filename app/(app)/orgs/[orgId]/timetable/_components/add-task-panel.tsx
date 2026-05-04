"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Search as SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
export function AddTaskPanel({ tasks, orgId, anchor, todayStr }: AddTaskPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "schedule">("list");
  const [selectedTask, setSelectedTask] = useState<SharedTask | null>(null);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(anchor >= todayStr ? anchor : todayStr);
  const [timeStr, setTimeStr] = useState("09:00");
  const [isPending, startTransition] = useTransition();

  const filtered = tasks
    .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.roleName && b.roleName) return a.roleName.localeCompare(b.roleName);
      if (a.roleName) return -1;
      if (b.roleName) return 1;
      return a.name.localeCompare(b.name);
    });

  function handleTaskClick(task: SharedTask) {
    setSelectedTask(task);
    setMode("schedule");
  }

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData("timetable/taskId", taskId);
    e.dataTransfer.effectAllowed = "copy";
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
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
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
        toast.error(error instanceof Error ? error.message : "Something went wrong");
      }
    });
  }

  // ── Schedule form ────────────────────────────────────────────────────────
  if (mode === "schedule" && selectedTask) {
    return (
      <div className="flex flex-col gap-4">
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
            <label htmlFor="date-input" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
            <label htmlFor="start-time-input" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
    <div className="flex flex-col gap-2">
      <div className="relative">
        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          id="search-input"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-7 h-8 text-sm"
          aria-label="Search tasks"
        />
      </div>

      <div className="flex flex-col -mx-4">
        {filtered.length === 0 ? (
          <div className="px-4 py-3 text-xs text-muted-foreground italic">
            No tasks found
          </div>
        ) : (
          filtered.map((task) => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => handleDragStart(e, task.id)}
              onClick={() => handleTaskClick(task)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleTaskClick(task);
                }
              }}
              className="relative px-4 py-2.5 border-b last:border-b-0 transition-colors select-none cursor-pointer hover:bg-muted/30 active:bg-muted/50"
            >
              <span
                className="absolute left-4 inset-y-0 w-1 rounded-r-sm"
                style={{
                  backgroundColor:
                    task.roleColor ?? task.color ?? "#9ca3af",
                }}
              />
              <div className="pl-3 text-sm font-medium">{task.name}</div>
              <div className="pl-3 text-xs text-muted-foreground">
                {task.roleName ? `${task.roleName} · ` : ""}
                {task.durationMin} min
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
