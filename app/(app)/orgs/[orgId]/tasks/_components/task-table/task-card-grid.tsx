"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Task } from "./task-types";

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function ownershipBadge(task: Task, orgId: string) {
  if (task._available) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
        Available
      </span>
    );
  }
  if (task.orgId !== orgId) {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
        Franchise
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      Mine
    </span>
  );
}

function stripMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[•\-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\n/g, " ")
    .trim();
}

interface TaskCardGridProps {
  orgId: string;
  tasks: Task[];
  canManageTasks: boolean;
  isPending: boolean;
  onAddToList: (task: Task) => void;
  onDeleteClick: (task: Task) => void;
}

export function TaskCardGrid({
  orgId,
  tasks,
  canManageTasks,
  isPending,
  onAddToList,
  onDeleteClick,
}: TaskCardGridProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          tabIndex={0}
          role="button"
          className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-all overflow-hidden relative group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => router.push(`/orgs/${orgId}/tasks/${task.id}`)}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push(`/orgs/${orgId}/tasks/${task.id}`);
            }
          }}
        >
          {task.imageSignedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={task.imageSignedUrl}
              alt=""
              className="w-full h-36 object-cover"
            />
          ) : (
            <div
              className="h-36 w-full flex items-center justify-center text-5xl font-bold select-none"
              style={{
                backgroundColor: task.color + "25",
                color: task.color,
              }}
            >
              {task.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="p-4">
            <div className="flex flex-col gap-3">
              <div className="font-semibold text-sm leading-snug">
                {task.name}
              </div>
              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {stripMd(task.description)}
                </p>
              )}
              {task.eligibility.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {task.eligibility.map((e) => (
                    <span
                      key={e.role.id}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                    >
                      {e.role.color && (
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: e.role.color }}
                        />
                      )}
                      {e.role.name}
                    </span>
                  ))}
                </div>
              )}
              {task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((tt) => (
                    <span
                      key={tt.tag.id}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
                    >
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: tt.tag.color }}
                      />
                      {tt.tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div
            className="flex items-center justify-between px-3 py-2 border-t"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              {ownershipBadge(task, orgId)}
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {formatDuration(task.durationMin)}
              </span>
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {task.minPeople}+ ppl
              </span>
            </div>
            {canManageTasks && task._available && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isPending}
                title="Add to my list"
                onClick={() => onAddToList(task)}
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">Add to list</span>
              </Button>
            )}
            {canManageTasks && !task._available && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={isPending}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Task actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/orgs/${orgId}/tasks/${task.id}/edit`);
                    }}
                  >
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/orgs/${orgId}/tasks/new?duplicateFrom=${task.id}`);
                    }}
                  >
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick(task);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
