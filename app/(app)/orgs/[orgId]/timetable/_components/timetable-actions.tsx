"use client";

/**
 * TimetableActions — action buttons rendered in the timetable sidebar.
 * Both buttons open their panels inside ActionSidebarSlot
 * (desktop: inline sidebar, mobile: bottom sheet).
 *
 * Only rendered when canManage is true (enforced by TimetableSidebarContent).
 */
import { useRef } from "react";
import { CalendarCheck, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
import {
  ApplyTemplateForm,
  type TemplateOption,
} from "./apply-template-dialog";
import { AddTaskPanel } from "./add-task-panel";
import type { SharedTask } from "../_shared/types";

interface TimetableActionsProps {
  orgId: string;
  templates: TemplateOption[];
  anchor: string;
  todayStr: string;
  userId?: string;
  tasks?: SharedTask[];
}

/**
 * Renders action buttons for the timetable sidebar.
 * "Apply Template" opens in the ActionSidebar on desktop, or a dialog on mobile.
 */
export function TimetableActions({
  orgId,
  templates,
  anchor,
  todayStr,
  userId,
  tasks,
}: TimetableActionsProps) {
  const { open, close, activeTitle } = useActionSidebar();
  const formKeyRef = useRef(0);
  const addTaskKeyRef = useRef(0);

  function openApplyTemplate() {
    const k = ++formKeyRef.current;
    open(
      "Apply Template",
      <ApplyTemplateForm
        key={k}
        onOpenChange={close}
        orgId={orgId}
        templates={templates}
        defaultStartDate={anchor}
        todayStr={todayStr}
        userId={userId}
      />,
    );
  }

  return (
    <>
      <Button
        variant={activeTitle === "Apply Template" ? "default" : "outline"}
        size="sm"
        onClick={openApplyTemplate}
        className="w-full justify-start gap-2"
        data-tour-target="timetable-apply-template"
      >
        <CalendarCheck className="h-4 w-4 shrink-0" />
        Apply Template
      </Button>
      <Button
        variant={activeTitle === "Add Task" ? "default" : "outline"}
        size="sm"
        className="w-full justify-start gap-2"
        data-tour-target="timetable-add-task"
        disabled={!tasks?.length}
        onClick={() => {
          if (!tasks?.length) return;
          const k = ++addTaskKeyRef.current;
          open(
            "Add Task",
            <AddTaskPanel
              key={k}
              tasks={tasks}
              orgId={orgId}
              anchor={anchor}
              todayStr={todayStr}
            />,
          );
        }}
      >
        <ListPlus className="h-4 w-4 shrink-0" />
        Add Task
      </Button>
    </>
  );
}
