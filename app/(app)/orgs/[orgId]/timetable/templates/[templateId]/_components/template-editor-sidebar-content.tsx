"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListPlus, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimetableViewPicker } from "../../../_components/timetable-view-picker";
import { ColorFilterButton } from "../../../_components/color-filter-button";
import { useTimetableZoom, MIN_HOUR_HEIGHT, MAX_HOUR_HEIGHT } from "../../../_shared/timetable-zoom-context";
import { AddTemplateTaskPanel } from "./add-template-task-panel";
import { updateTemplateDaysAction } from "@/app/actions/templates";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
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
  onModeChange: (mode: "calendar" | "simple") => void;
  onSpanChange: (span: "day" | "week") => void;
  availableTasks: SharedTask[];
  colorFilter?: "task" | "role" | "tag";
  onColorFilterChange?: (value: "task" | "role" | "tag") => void;
}

function ZoomSlider() {
  const { hourHeight, setHourHeight } = useTimetableZoom();

  return (
    <div className="mt-3 px-1">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-xs font-medium text-muted-foreground">Zoom</span>
        <span className="text-xs tabular-nums text-muted-foreground">{hourHeight}px</span>
      </div>
      <input
        type="range"
        min={MIN_HOUR_HEIGHT}
        max={MAX_HOUR_HEIGHT}
        value={hourHeight}
        onChange={(e) => setHourHeight(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-primary"
      />
    </div>
  );
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
  onModeChange,
  onSpanChange,
  availableTasks,
  colorFilter,
  onColorFilterChange,
}: TemplateEditorSidebarContentProps) {
  const router = useRouter();
  const [isPending, startT] = useTransition();
  const { open, activeTitle } = useActionSidebar();
  const taskPanelKeyRef = useRef(0);

  function handleAddTask() {
    const k = ++taskPanelKeyRef.current;
    open(
      "Add Task",
      <AddTemplateTaskPanel
        key={k}
        tasks={availableTasks}
        orgId={orgId}
        templateId={templateId}
        templateDays={templateDays}
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
      {/* Filters section */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          Filters
        </p>
        <div className="flex flex-col gap-2">
          <ColorFilterButton value={colorFilter} onChange={onColorFilterChange} />
        </div>
      </div>

      <div className="px-3 pt-2.5 pb-3 border-t border-border">
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
          onModeChange={onModeChange}
          onSpanChange={onSpanChange}
          className="flex-col items-start"
        />
        {mode === "calendar" && <ZoomSlider />}
      </div>

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
