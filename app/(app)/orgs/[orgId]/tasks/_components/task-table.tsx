"use client";

/**
 * Interactive task table for the Tasks list page.
 *
 * Self-fetches tasks from /api/orgs/[orgId]/tasks/paginated using
 * cursor-based infinite scroll (IntersectionObserver on a sentinel div).
 *
 * All filtering params (sort, roleId, tagId, mode) come from URL-driven props.
 * Local search is debounced and triggers a fresh fetch from the start.
 */
import { useState, useReducer, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { MoreHorizontal, ListTodo, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deleteTaskAction,
  removeTaskFromListAction,
  inheritTaskAction,
} from "@/app/actions/tasks";
import { TaskListSkeleton, TaskCardSkeleton } from "./task-skeletons";
import type { SortOption } from "./tasks-config";

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

// Strip markdown syntax for plain-text previews
function stripMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^[•\-*]\s+/gm, "") // bullet lists
    .replace(/^\d+\.\s+/gm, "") // numbered lists
    .replace(/\n/g, " ") // collapse newlines
    .trim();
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Task = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  durationMin: number;
  minPeople: number;
  orgId: string;
  _available: boolean;
  _count: { inheritedBy: number };
  eligibility: { role: { id: string; name: string; color: string | null } }[];
  tags: { tag: { id: string; name: string; color: string } }[];
  imageSignedUrl: string | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

interface TaskTableProps {
  orgId: string;
  mode: "list" | "available" | "shared";
  canManageTasks: boolean;
  sort: SortOption;
  filterRoleId: string | null;
  filterTagId: string | null;
  view: "list" | "card";
}

export function TaskTable({
  orgId,
  mode,
  canManageTasks,
  sort,
  filterRoleId,
  filterTagId,
  view,
}: TaskTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = usePersistedState(`tasks-search-${orgId}`, "");
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  // ── Pagination state ──────────────────────────────────────────────────────
  type PageState = {
    tasks: Task[];
    nextCursor: string | null;
    isFetching: boolean;
    initialLoad: boolean;
  };
  type PageAction =
    | { type: "reset" }
    | { type: "loaded"; tasks: Task[]; nextCursor: string | null }
    | { type: "load_error" }
    | { type: "load_more" }
    | { type: "more_loaded"; tasks: Task[]; nextCursor: string | null }
    | { type: "more_done" };

  function pageReducer(state: PageState, action: PageAction): PageState {
    switch (action.type) {
      case "reset":
        return { tasks: [], nextCursor: null, isFetching: true, initialLoad: true };
      case "loaded":
        return { ...state, tasks: action.tasks, nextCursor: action.nextCursor, isFetching: false, initialLoad: false };
      case "load_error":
        return { ...state, isFetching: false, initialLoad: false };
      case "load_more":
        return { ...state, isFetching: true };
      case "more_loaded":
        return { ...state, tasks: [...state.tasks, ...action.tasks], nextCursor: action.nextCursor };
      case "more_done":
        return { ...state, isFetching: false };
      default:
        return state;
    }
  }

  const [{ tasks, nextCursor, isFetching, initialLoad }, dispatch] = useReducer(
    pageReducer,
    { tasks: [], nextCursor: null, isFetching: false, initialLoad: true },
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Track the "reset key" — whenever filters change, reset and refetch from scratch.
  const resetKeyRef = useRef(0);

  const buildUrl = useCallback(
    (cursor: string | null | undefined) => {
      const url = new URL(
        `/api/orgs/${orgId}/tasks/paginated`,
        window.location.origin,
      );
      url.searchParams.set("mode", mode);
      url.searchParams.set("sort", sort);
      if (filterRoleId) url.searchParams.set("roleId", filterRoleId);
      if (filterTagId) url.searchParams.set("tagId", filterTagId);
      if (search) url.searchParams.set("search", search);
      if (cursor) url.searchParams.set("cursor", cursor);
      return url.toString();
    },
    [orgId, mode, sort, filterRoleId, filterTagId, search],
  );

  // Reset and fetch first page whenever filters / mode change.
  useEffect(() => {
    const key = ++resetKeyRef.current;
    dispatch({ type: "reset" });

    let cancelled = false;
    fetch(buildUrl(null))
      .then((r) => r.json() as Promise<{ tasks: Task[]; nextCursor: string | null }>)
      .then((data) => {
        if (cancelled || resetKeyRef.current !== key) return;
        dispatch({ type: "loaded", tasks: data.tasks, nextCursor: data.nextCursor });
      })
      .catch(() => {
        if (!cancelled && resetKeyRef.current === key) dispatch({ type: "load_error" });
      });

    return () => {
      cancelled = true;
    };
  }, [buildUrl]);

  // Load next page — called by IntersectionObserver
  const loadMore = useCallback(() => {
    if (isFetching || !nextCursor) return;
    const key = resetKeyRef.current;
    dispatch({ type: "load_more" });
    fetch(buildUrl(nextCursor))
      .then((r) => r.json() as Promise<{ tasks: Task[]; nextCursor: string | null }>)
      .then((data) => {
        if (resetKeyRef.current !== key) return;
        dispatch({ type: "more_loaded", tasks: data.tasks, nextCursor: data.nextCursor });
      })
      .catch(() => {/* swallow, next intersection will retry */})
      .finally(() => {
        if (resetKeyRef.current === key) dispatch({ type: "more_done" });
      });
  }, [isFetching, nextCursor, buildUrl]);

  // IntersectionObserver on the sentinel at the bottom of the list
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  function handleDeleteClick(task: Task) {
    setDeleteTarget(task);
  }

  function handleRemoveFromList() {
    if (!deleteTarget) return;
    const taskId = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await removeTaskFromListAction(orgId, taskId);
      if (result.ok) {
        toast.success("Removed from list.");
        // Remove from local state immediately
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const taskId = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteTaskAction(orgId, taskId);
      if (result.ok) {
        toast.success("Task deleted.");
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleAddToList(task: Task) {
    startTransition(async () => {
      const result = await inheritTaskAction(orgId, task.id);
      if (result.ok) {
        toast.success(`"${task.name}" added to your list.`);
        // Move from available → inherited in local state
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, _available: false } : t,
          ),
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isEmpty = !initialLoad && tasks.length === 0;
  const hasMore = !!nextCursor;

  return (
    <>
      <RegisterPageToolbar>
        <Input
          aria-label="Search tasks by title"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 h-7 min-w-50"
        />
      </RegisterPageToolbar>

      <div>
        {initialLoad ? (
          view === "card" ? (
            <TaskCardSkeleton count={6} />
          ) : (
            <TaskListSkeleton count={8} />
          )
        ) : isEmpty ? (
          <div className="flex items-center justify-center border py-24">
            <div className="flex flex-col items-center gap-3 text-center">
              <ListTodo className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-2xl font-semibold text-foreground">
                {search ? "No tasks match your search" : "No tasks yet"}
              </p>
              {!search && canManageTasks && (
                <a
                  href={`/orgs/${orgId}/tasks/new`}
                  className="text-sm text-primary hover:underline"
                >
                  Create your first task
                </a>
              )}
            </div>
          </div>
        ) : view === "card" ? (
          <>
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
                  {/* Cover image or colored initial block */}
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
                        onClick={() => handleAddToList(task)}
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
                              router.push(
                                `/orgs/${orgId}/tasks/${task.id}/edit`,
                              );
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/orgs/${orgId}/tasks/new?duplicateFrom=${task.id}`,
                              );
                            }}
                          >
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(task);
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
            {/* Load-more skeleton rows for card view */}
            {isFetching && hasMore && <TaskCardSkeleton count={3} />}
          </>
        ) : (
          <>
            <div className="rounded-lg border bg-card overflow-hidden shadow-sm divide-y divide-border">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  tabIndex={0}
                  role="button"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  onClick={() => router.push(`/orgs/${orgId}/tasks/${task.id}`)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/orgs/${orgId}/tasks/${task.id}`);
                    }
                  }}
                >
                  {/* Color accent bar */}
                  <div
                    className="w-1 self-stretch rounded-full shrink-0"
                    style={{ backgroundColor: task.color }}
                  />

                  {/* Thumbnail */}
                  {task.imageSignedUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={task.imageSignedUrl}
                      alt=""
                      className="w-9 h-9 rounded-md object-cover shrink-0 hidden sm:block"
                    />
                  )}

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {task.name}
                      </span>
                      {task.tags.length > 0 && (
                        <div className="hidden md:flex items-center gap-1 shrink-0">
                          {task.tags.slice(0, 5).map((tt) => (
                            <span
                              key={tt.tag.id}
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: tt.tag.color }}
                              title={tt.tag.name}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5 leading-relaxed">
                        {stripMd(task.description)}
                      </p>
                    )}
                    {/* Mobile-only metadata row */}
                    <div className="flex sm:hidden items-center gap-2 mt-1.5 flex-wrap">
                      {ownershipBadge(task, orgId)}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDuration(task.durationMin)}
                      </span>
                      <span className="text-muted-foreground/40 text-xs select-none">·</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {task.minPeople}+ ppl
                      </span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="hidden sm:flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                    {ownershipBadge(task, orgId)}
                    <span className="tabular-nums">
                      {formatDuration(task.durationMin)}
                    </span>
                    <span className="tabular-nums">{task.minPeople}+ ppl</span>
                    <div className="hidden md:flex items-center gap-1">
                      {task.eligibility.length === 0 ? (
                        <span className="text-muted-foreground/40">—</span>
                      ) : (
                        <>
                          {task.eligibility.slice(0, 2).map((e) => (
                            <span
                              key={e.role.id}
                              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
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
                          {task.eligibility.length > 2 && (
                            <span>+{task.eligibility.length - 2}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions — hidden until hover */}
                  {canManageTasks && (
                    <div
                      className="shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {task._available ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isPending}
                          title="Add to my list"
                          onClick={() => handleAddToList(task)}
                        >
                          <Plus className="h-4 w-4" />
                          <span className="sr-only">Add to list</span>
                        </Button>
                      ) : (
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
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/orgs/${orgId}/tasks/${task.id}/edit`,
                                )
                              }
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled
                              onClick={() =>
                                router.push(
                                  `/orgs/${orgId}/tasks/new?duplicateFrom=${task.id}`,
                                )
                              }
                            >
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteClick(task)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Skeleton rows appended while loading more */}
            {isFetching && hasMore && <TaskListSkeleton count={4} />}
          </>
        )}

        {/* Sentinel — triggers loadMore when scrolled into view */}
        <div ref={sentinelRef} className="h-1" aria-hidden />

        {/* Bottom spinner when loading more (non-initial) */}
        {isFetching && !initialLoad && !hasMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Delete / remove confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove task</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.orgId === orgId ? (
                <>
                  How would you like to remove{" "}
                  <span className="font-medium">{deleteTarget?.name}</span>?
                </>
              ) : (
                <>
                  Remove{" "}
                  <span className="font-medium">{deleteTarget?.name}</span> from
                  your list?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveFromList}>
              Remove from list
            </AlertDialogAction>
            {deleteTarget?.orgId === orgId && (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
              >
                {deleteTarget._count.inheritedBy > 1
                  ? "Delete permanently"
                  : "Delete"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

