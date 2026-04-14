"use client";

import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SharedTask } from "./types";

interface TaskPanelProps {
  tasks: SharedTask[];
  fillHeight?: boolean;
  fullWidth?: boolean;
  onDragStart: (taskId: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  selectedTaskId?: string | null;
  onTaskSelect?: (taskId: string | null) => void;
  tapToPlaceMode?: boolean;
}

/**
 * Sidebar panel listing draggable tasks.
 * Used by both the live timetable and the template editor.
 */
export function TaskPanel({
  tasks,
  fillHeight,
  fullWidth,
  onDragStart,
  onDragEnd,
  selectedTaskId,
  onTaskSelect,
  tapToPlaceMode,
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

  return (
    <div
      className={`${fullWidth ? "w-full" : "w-56"} shrink-0 rounded-xl border bg-card flex flex-col overflow-hidden${fillHeight ? " min-h-0" : ""}`}
    >
      <div className="px-3 py-2.5 font-medium text-sm border-b shrink-0">
        Tasks
      </div>
      <div className="px-2 py-2 border-b shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-sm"
          />
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-3 text-xs text-muted-foreground italic">
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
                    : undefined
                }
                role={tapToPlaceMode ? "button" : undefined}
                tabIndex={tapToPlaceMode ? 0 : undefined}
                aria-pressed={tapToPlaceMode ? isSelected : undefined}
                onKeyDown={
                  tapToPlaceMode && onTaskSelect
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onTaskSelect(isSelected ? null : task.id);
                        }
                      }
                    : undefined
                }
                className={`relative px-3 py-2.5 border-b last:border-b-0 transition-colors select-none pl-4 ${
                  tapToPlaceMode
                    ? `cursor-pointer ${isSelected ? "bg-primary/20 hover:bg-primary/25" : "hover:bg-muted/30"}`
                    : "cursor-grab active:cursor-grabbing hover:bg-muted/30"
                }`}
              >
                <span
                  className="absolute left-0 inset-y-0 w-1 rounded-r-sm"
                  style={{
                    backgroundColor: task.roleColor ?? task.color ?? "#9ca3af",
                  }}
                />
                <div className="text-sm font-medium">{task.name}</div>
                <div className="text-xs text-muted-foreground">
                  {task.roleName ? `${task.roleName} · ` : ""}
                  {task.durationMin} min
                </div>
                {tapToPlaceMode && isSelected && (
                  <div className="text-xs text-primary font-medium mt-1">
                    Tap on grid to place
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
