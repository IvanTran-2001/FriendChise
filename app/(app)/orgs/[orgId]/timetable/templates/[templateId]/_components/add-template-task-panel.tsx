"use client";

import { useState, useTransition, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskPanel } from "../../../_shared/task-panel";
import { getDragHandlers } from "../../../_shared/drag-registry";
import { addTemplateInstanceAction } from "@/app/actions/templates";
import type { SharedTask } from "../../../_shared/types";

interface AddTemplateTaskPanelProps {
  tasks: SharedTask[];
  orgId: string;
  templateId: string;
  templateDays: number;
  /** Optional initial state when opened from a drop */
  initialMode?: "list" | "schedule";
  initialTaskId?: string;
  initialDayIndex?: number;
  initialTimeStr?: string;
  onClose?: () => void;
}

export function AddTemplateTaskPanel({
  tasks,
  orgId,
  templateId,
  templateDays,
  initialMode,
  initialTaskId,
  initialDayIndex,
  initialTimeStr,
  onClose,
}: AddTemplateTaskPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "schedule">(initialMode ?? "list");
  const [selectedTask, setSelectedTask] = useState<SharedTask | null>(
    initialTaskId ? tasks.find((t) => t.id === initialTaskId) ?? null : null,
  );
  const [dayIndex, setDayIndex] = useState(initialDayIndex ?? 0); // 0-based
  const [timeStr, setTimeStr] = useState(initialTimeStr ?? "09:00");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const evt =
      mode === "schedule"
        ? "template:schedule-mode-enter"
        : "template:schedule-mode-exit";
    window.dispatchEvent(new CustomEvent(evt));
  }, [mode]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent("template:schedule-mode-exit"));
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
    const [hours, minutes] = timeStr.split(":").map(Number);
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
        const result = await addTemplateInstanceAction(
          orgId,
          templateId,
          selectedTask.id,
          dayIndex,
          startTimeMin,
        );
        if (!result.ok) {
          toast.error(result.error ?? "Something went wrong");
          return;
        }
        router.refresh();
        handleBack();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Something went wrong",
        );
      }
    });
  }

  if (mode === "schedule" && selectedTask) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -mx-1 px-1 py-0.5 rounded w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5 cursor-pointer" />
          Back to tasks
        </button>

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

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="template-day-input"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Day
            </label>
            <select
              id="template-day-input"
              value={dayIndex}
              onChange={(e) => setDayIndex(Number(e.target.value))}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Array.from({ length: templateDays }, (_, i) => (
                <option key={i} value={i}>
                  Day {i + 1}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="template-time-input"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Start time
            </label>
            <Input
              id="template-time-input"
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={isPending} size="sm">
          {isPending ? "Adding…" : "Add to template"}
        </Button>
      </div>
    );
  }

  return (
    <TaskPanel
      tasks={tasks}
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
  );
}
