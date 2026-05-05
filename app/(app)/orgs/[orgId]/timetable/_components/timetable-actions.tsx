"use client";

/**
 * TimetableActions — action buttons rendered in the timetable sidebar.
 *
 * Desktop:
 *   - "Apply Template" opens ApplyTemplateForm inside ActionSidebarSlot.
 *   - "Add Task" opens AddTaskPanel inside ActionSidebarSlot.
 *   The active button highlights (variant="default") when its panel is open.
 *
 * Mobile:
 *   - "Apply Template" opens ApplyTemplateDialog (modal).
 *   - "Add Task" closes the mobile page-sidebar overlay and fires a
 *     `timetable:open-task-panel` CustomEvent, which CalendarView picks up
 *     to open its existing Sheet.
 *
 * Only rendered when canManage is true (enforced by TimetableSidebarContent).
 */
import { useRef, useState } from "react";
import { CalendarCheck, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMobileSidebar } from "@/components/layout/mobile-sidebar-context";
import {
  ApplyTemplateForm,
  ApplyTemplateDialog,
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
  const isMobile = useIsMobile();
  const { setOpen: setMobileSidebarOpen } = useMobileSidebar();
  const formKeyRef = useRef(0);
  const addTaskKeyRef = useRef(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  function openApplyTemplate() {
    if (isMobile) {
      setDialogKey((k) => k + 1);
      setDialogOpen(true);
    } else {
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
  }

  return (
    <>
      <Button
        variant={activeTitle === "Apply Template" ? "default" : "outline"}
        size="sm"
        onClick={openApplyTemplate}
        className="w-full justify-start gap-2"
      >
        <CalendarCheck className="h-4 w-4 shrink-0" />
        Apply Template
      </Button>
      <Button
        variant={activeTitle === "Add Task" ? "default" : "outline"}
        size="sm"
        className="w-full justify-start gap-2"
        disabled={!tasks?.length}
        onClick={() => {
          if (!tasks?.length) return;
          if (isMobile) {
            setMobileSidebarOpen(false);
            window.dispatchEvent(new CustomEvent("timetable:open-task-panel"));
            return;
          }
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
      <ApplyTemplateDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orgId={orgId}
        templates={templates}
        defaultStartDate={anchor}
        todayStr={todayStr}
        userId={userId}
      />
    </>
  );
}
