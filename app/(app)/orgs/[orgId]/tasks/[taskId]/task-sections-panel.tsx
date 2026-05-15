"use client";

/**
 * TaskSectionsPanel — drag-to-reorder section layout editor.
 *
 * Rendered inside the ActionSidebar. Receives the initial section list from
 * the server (so there is no loading state). The user can:
 *  - Drag rows to reorder
 *  - Toggle section visibility
 *  - Toggle scope (ORG → only this org / GLOBAL → shared back to franchisor)
 *    — only shown for inherited tasks or when the section scope is already set
 *
 * Changes are saved when the user clicks "Save Layout".
 */
import { useState, useRef, useTransition } from "react";
import { Eye, EyeOff, GripVertical, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateSectionLayoutAction } from "@/app/actions/tasks";
import type { SectionLayoutInput } from "@/lib/services/task-sections";

export type SectionRow = {
  id: string;
  type: string;
  title: string;
  scope: "ORG" | "GLOBAL";
  position: number;
  visible: boolean;
};

interface TaskSectionsPanelProps {
  orgId: string;
  taskId: string;
  initialSections: SectionRow[];
  onSaved?: () => void;
}

export function TaskSectionsPanel({
  orgId,
  taskId,
  initialSections,
  onSaved,
}: TaskSectionsPanelProps) {
  const [sections, setSections] = useState<SectionRow[]>(
    [...initialSections].sort((a, b) => a.position - b.position),
  );
  const [pending, startTransition] = useTransition();
  const dragIdx = useRef<number | null>(null);

  // ---- Drag & Drop ----------------------------------------------------------

  function handleDragStart(idx: number) {
    dragIdx.current = idx;
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === idx) return;
    setSections((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved);
      dragIdx.current = idx;
      return next;
    });
  }

  function handleDragEnd() {
    dragIdx.current = null;
  }

  // ---- Mutations ------------------------------------------------------------

  function toggleVisible(idx: number) {
    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, visible: !s.visible } : s)),
    );
  }

  // ---- Save -----------------------------------------------------------------

  function handleSave() {
    const payload: SectionLayoutInput[] = sections.map((s, i) => ({
      type: s.type,
      title: s.title,
      scope: s.scope as "ORG" | "GLOBAL",
      position: i,
      visible: s.visible,
    }));
    startTransition(async () => {
      const result = await updateSectionLayoutAction(orgId, taskId, payload);
      if (result.ok) {
        toast.success("Section layout saved");
        onSaved?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-xs text-muted-foreground">
        Drag to reorder. Hidden sections are still recorded but won&apos;t
        appear in the task view.
      </p>

      <div className="flex flex-col gap-1">
        {sections.map((section, idx) => (
          <div
            key={section.type}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 cursor-grab active:cursor-grabbing select-none"
          >
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span
              className={`flex-1 text-sm ${section.visible ? "" : "line-through text-muted-foreground"}`}
            >
              {section.title}
            </span>
            <button
              onClick={() => toggleVisible(idx)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={section.visible ? "Hide section" : "Show section"}
            >
              {section.visible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </button>
          </div>
        ))}
      </div>

      <Button
        size="sm"
        className="gap-1.5"
        onClick={handleSave}
        disabled={pending}
      >
        <Save className="h-3.5 w-3.5" />
        Save Layout
      </Button>
    </div>
  );
}
