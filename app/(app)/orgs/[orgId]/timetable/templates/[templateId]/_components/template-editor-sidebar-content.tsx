"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListPlus, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimetableViewPicker } from "../../../_components/timetable-view-picker";
import { TaskPanel } from "../../../_shared/task-panel";
import { updateTemplateDaysAction } from "@/app/actions/templates";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMobileSidebar } from "@/components/layout/mobile-sidebar-context";
import type { SharedTask } from "../../../_shared/types";

interface TemplateEditorSidebarContentProps {
  orgId: string;
  templateId: string;
  templateDays: number;
  mode: "calendar" | "simple";
  span: "day" | "week";
  calendarHref: string;
  simpleHref: string;
  dayHref: string;
  weekHref: string;
  availableTasks: SharedTask[];
}

export function TemplateEditorSidebarContent({
  orgId,
  templateId,
  templateDays,
  mode,
  span,
  calendarHref,
  simpleHref,
  dayHref,
  weekHref,
  availableTasks,
}: TemplateEditorSidebarContentProps) {
  const router = useRouter();
  const [isPending, startT] = useTransition();
  const { open, activeTitle } = useActionSidebar();
  const isMobile = useIsMobile();
  const { setOpen: setMobileSidebarOpen } = useMobileSidebar();
  const taskPanelKeyRef = useRef(0);

  function handleAddTask() {
    if (isMobile) {
      setMobileSidebarOpen(false);
      window.dispatchEvent(new CustomEvent("template:open-task-panel"));
      return;
    }
    const k = ++taskPanelKeyRef.current;
    open(
      "Add Task",
      <TaskPanel
        key={k}
        tasks={availableTasks}
        fillHeight
        onDragStart={(taskId, e) => {
          e.dataTransfer.setData("timetable/taskId", taskId);
          e.dataTransfer.effectAllowed = "copy";
        }}
        onDragEnd={() => {}}
      />,
    );
  }

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
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      {/* View section */}
      <div className="px-3 pt-3 pb-3">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          View
        </p>
        <TimetableViewPicker
          mode={mode}
          span={span}
          calendarHref={calendarHref}
          simpleHref={simpleHref}
          dayHref={dayHref}
          weekHref={weekHref}
          className="flex-col items-start"
        />
      </div>

      {/* Actions section */}
      <div className="px-3 pt-2 pb-3 border-t border-border">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          Actions
        </p>
        <Button
          variant={activeTitle === "Add Task" ? "default" : "outline"}
          size="sm"
          onClick={handleAddTask}
          disabled={!availableTasks.length}
          className="w-full justify-start gap-2"
        >
          <ListPlus className="h-4 w-4 shrink-0" />
          Add Task
        </Button>

        {/* Cycle length stepper */}
        <div className="flex items-center gap-2 mt-2 px-1">
          <span className="text-sm text-muted-foreground flex-1">
            Cycle length
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleRemoveDay}
            disabled={templateDays <= 1 || isPending}
            title="Remove last day"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="text-sm font-medium w-14 text-center tabular-nums">
            {templateDays} day{templateDays !== 1 ? "s" : ""}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleAddDay}
            disabled={isPending}
            title="Add day"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
