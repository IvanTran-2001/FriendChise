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
import { formatDuration, ownershipBadge, stripMd } from "./task-format-utils";

interface TaskListViewProps {
  orgId: string;
  tasks: Task[];
  canManageTasks: boolean;
  isPending: boolean;
  onAddToList: (task: Task) => void;
  onDeleteClick: (task: Task) => void;
}

export function TaskListView({
  orgId,
  tasks,
  canManageTasks,
  isPending,
  onAddToList,
  onDeleteClick,
}: TaskListViewProps) {
  const router = useRouter();
  const isFryMorningBatchesTask = (name: string) => name.toLowerCase().includes("fry morning batches");

  return (
    <>
      <ul className="md:hidden flex flex-col divide-y rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm touch-pan-y">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="px-3 py-2 transition-colors hover:bg-muted/40"
            data-tour-target={isFryMorningBatchesTask(task.name) ? "task-fry-morning-batches" : undefined}
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-2 text-left touch-pan-y cursor-pointer"
                onClick={() => router.push(`/orgs/${orgId}/tasks/${task.id}`)}
              >
                {task.imageSignedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={task.imageSignedUrl}
                    alt=""
                    className="h-8 w-8 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold shrink-0"
                    style={{
                      backgroundColor: task.color + "25",
                      color: task.color,
                    }}
                  >
                    {task.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{task.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    {ownershipBadge(task, orgId)}
                    <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 font-medium leading-none">
                      {formatDuration(task.durationMin)}
                    </span>
                  </div>
                </div>
              </button>

              {canManageTasks && task._available && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 touch-pan-y cursor-pointer"
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
                      className="h-8 w-8 shrink-0 touch-pan-y cursor-pointer"
                      disabled={isPending}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Task actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => router.push(`/orgs/${orgId}/tasks/${task.id}/edit`)}
                    >
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDeleteClick(task)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {task.description && (
              <p className="mt-2 hidden text-xs text-muted-foreground leading-relaxed sm:block sm:line-clamp-1">
                {stripMd(task.description)}
              </p>
            )}

            <div className="mt-1.5 hidden flex-wrap gap-1 sm:flex">
              {task.eligibility.length > 0 ? (
                task.eligibility.map((e) => (
                  <span
                    key={e.role.id}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-foreground"
                  >
                    {e.role.color && (
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: e.role.color }}
                      />
                    )}
                    {e.role.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">All roles</span>
              )}
              {task.tags.length > 0 ? (
                task.tags.map((tt) => (
                  <span
                    key={tt.tag.id}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium text-foreground"
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: tt.tag.color }}
                    />
                    {tt.tag.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No tags</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <ul className="hidden flex-col divide-y rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm md:flex">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
            data-tour-target={isFryMorningBatchesTask(task.name) ? "task-fry-morning-batches" : undefined}
          >
            <button
              type="button"
              className="flex min-w-0 flex-[1.4] items-start gap-3 text-left cursor-pointer"
              onClick={() => router.push(`/orgs/${orgId}/tasks/${task.id}`)}
            >
              {task.imageSignedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={task.imageSignedUrl}
                  alt=""
                  className="h-10 w-10 rounded-md object-cover shrink-0"
                />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold shrink-0"
                  style={{
                    backgroundColor: task.color + "25",
                    color: task.color,
                  }}
                >
                  {task.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">{task.name}</div>
                {task.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground leading-relaxed">
                    {stripMd(task.description)}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ownershipBadge(task, orgId)}
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {formatDuration(task.durationMin)}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {task.minPeople}+ ppl
                  </span>
                </div>
              </div>
            </button>

            <div className="hidden flex-1 flex-wrap gap-1.5 self-start pt-1 text-muted-foreground lg:flex">
              {task.eligibility.length > 0 ? (
                task.eligibility.map((e) => (
                  <span
                    key={e.role.id}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-foreground"
                  >
                    {e.role.color && (
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: e.role.color }}
                      />
                    )}
                    {e.role.name}
                  </span>
                ))
              ) : (
                <span className="text-xs">All roles</span>
              )}
            </div>

            <div className="hidden flex-1 flex-wrap gap-1.5 self-start pt-1 text-muted-foreground lg:flex">
              {task.tags.length > 0 ? (
                task.tags.map((tt) => (
                  <span
                    key={tt.tag.id}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium text-foreground"
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: tt.tag.color }}
                    />
                    {tt.tag.name}
                  </span>
                ))
              ) : (
                <span className="text-xs">No tags</span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {canManageTasks && task._available && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 cursor-pointer"
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
                      className="h-8 w-8 shrink-0 cursor-pointer"
                      disabled={isPending}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Task actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => router.push(`/orgs/${orgId}/tasks/${task.id}/edit`)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDeleteClick(task)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}