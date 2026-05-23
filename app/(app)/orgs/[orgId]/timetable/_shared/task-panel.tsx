"use client";

import { useState } from "react";
import { SearchInput } from "@/components/ui/search-input";
import type { SharedTask } from "./types";

interface TaskPanelProps {
  tasks: SharedTask[];
  onDragStart: (taskId: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  selectedTaskId?: string | null;
  onTaskSelect?: (taskId: string | null) => void;
  tapToPlaceMode?: boolean;
  /** Called when a row is clicked in drag mode (not tapToPlaceMode). */
  onTaskClick?: (task: SharedTask) => void;
}

/**
 * Sidebar panel listing draggable tasks.
 * Used by both the live timetable and the template editor.
 */
export function TaskPanel({
  tasks,
  onDragStart,
  onDragEnd,
  selectedTaskId,
  onTaskSelect,
  tapToPlaceMode,
  onTaskClick,
}: TaskPanelProps) {
  const [search, setSearch] = useState("");
  const filtered = tasks
    .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.roleName && b.roleName) return a.roleName.localeCompare(b.roleName);
      if (a.roleName) return -1;
      if (b.roleName) return 1;
      return a.name.localeCompare(b.name);
    });

  const rows =
    filtered.length === 0 ? (
      <div className="px-4 py-3 text-xs text-muted-foreground italic">
        No tasks found
      </div>
    ) : (
      filtered.map((task) => {
        const isSelected = selectedTaskId === task.id;
        return (
          <div
            key={task.id}
            draggable={!tapToPlaceMode}
            onDragStart={
              !tapToPlaceMode ? (e) => onDragStart(task.id, e) : undefined
            }
            onDragEnd={!tapToPlaceMode ? onDragEnd : undefined}
            onClick={
              tapToPlaceMode && onTaskSelect
                ? () => onTaskSelect(isSelected ? null : task.id)
                : onTaskClick
                  ? () => onTaskClick(task)
                  : undefined
            }
            role={tapToPlaceMode || onTaskClick ? "button" : undefined}
            tabIndex={tapToPlaceMode || onTaskClick ? 0 : undefined}
            aria-pressed={tapToPlaceMode ? isSelected : undefined}
            onKeyDown={
              tapToPlaceMode && onTaskSelect
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onTaskSelect(isSelected ? null : task.id);
                    }
                  }
                : onTaskClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onTaskClick(task);
                      }
                    }
                  : undefined
            }
            className={`relative flex items-center min-h-12 px-4 border-b last:border-b-0 transition-colors select-none ${
              tapToPlaceMode
                ? `cursor-pointer ${isSelected ? "bg-primary/20 hover:bg-primary/25" : "hover:bg-muted/30"}`
                : onTaskClick
                  ? "cursor-pointer hover:bg-muted/30 active:bg-muted/50"
                  : "cursor-grab active:cursor-grabbing hover:bg-muted/30"
            }`}
          >
            <span
              className="absolute left-4 inset-y-0 w-1 rounded-r-sm"
              style={{
                backgroundColor: task.roleColor ?? task.color ?? "#9ca3af",
              }}
            />
            <div className="pl-3 text-sm font-medium">{task.name}</div>
            <div className="pl-3 text-xs text-muted-foreground">
              {task.roleName ? `${task.roleName} · ` : ""}
              {task.durationMin} min
            </div>
            {tapToPlaceMode && isSelected && (
              <div className="pl-3 text-xs text-primary font-medium mt-1">
                Tap on grid to place
              </div>
            )}
          </div>
        );
      })
    );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 py-2 border-b shrink-0">
        <SearchInput
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
          aria-label="Search tasks"
        />
      </div>
      <div className="flex flex-col overflow-y-auto flex-1">{rows}</div>
    </div>
  );
}
