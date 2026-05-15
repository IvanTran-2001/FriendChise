"use client";

/**
 * TaskSectionsTrigger — toolbar button that opens the section-layout panel in
 * the ActionSidebar. Receives the pre-loaded section list from the server so
 * the panel renders immediately without a loading state.
 */
import { LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { TaskSectionsPanel, type SectionRow } from "./task-sections-panel";

interface TaskSectionsTriggerProps {
  orgId: string;
  taskId: string;
  sections: SectionRow[];
}

export function TaskSectionsTrigger({ orgId, taskId, sections }: TaskSectionsTriggerProps) {
  const { open, close, activeTitle } = useActionSidebar();
  const PANEL_TITLE = "Sections";

  function handleOpen() {
    if (activeTitle === PANEL_TITLE) {
      close();
      return;
    }
    open(
      PANEL_TITLE,
      <TaskSectionsPanel
        orgId={orgId}
        taskId={taskId}
        initialSections={sections}
        onSaved={close}
      />,
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={handleOpen}
      aria-pressed={activeTitle === PANEL_TITLE}
    >
      <LayoutList className="h-4 w-4" />
      Sections
    </Button>
  );
}
