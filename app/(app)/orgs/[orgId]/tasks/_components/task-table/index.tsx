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
import { useState, useTransition, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import {
  deleteTaskAction,
  removeTaskFromListAction,
  inheritTaskAction,
} from "@/app/actions/tasks";
import { TaskCardSkeleton, TaskListSkeleton } from "../task-skeletons";
import type { SortOption } from "../tasks-config";
import { TaskCardGrid } from "./task-card-grid";
import { TaskEmptyState } from "./task-empty-state";
import { TaskListView } from "./task-list-view";
import { TaskRemoveDialog } from "./task-remove-dialog";
import { useTaskTablePagination } from "./use-task-table-pagination";
import type { Task } from "./task-types";

interface TaskTableProps {
  orgId: string;
  mode: "list" | "available" | "shared";
  canManageTasks: boolean;
  sort: SortOption;
  filterRoleId: string | null;
  filterTagId: string | null;
  view: "list" | "card";
  initialTasks: Task[];
  initialNextCursor: string | null;
}

export function TaskTable({
  orgId,
  mode,
  canManageTasks,
  sort,
  filterRoleId,
  filterTagId,
  view,
  initialTasks,
  initialNextCursor,
}: TaskTableProps) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = usePersistedState(`tasks-search-${orgId}`, "", {
    broadcast: false,
  });
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const {
    tasks,
    nextCursor,
    isFetching,
    initialLoad,
    sentinelRef,
    setTasks,
  } = useTaskTablePagination({
    orgId,
    mode,
    sort,
    filterRoleId,
    filterTagId,
    initialTasks,
    initialNextCursor,
    debouncedSearch,
  });

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
        setTasks(tasks.filter((t) => t.id !== taskId));
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
        setTasks(tasks.filter((t) => t.id !== taskId));
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
        setTasks(tasks.map((t) => (t.id === task.id ? { ...t, _available: false } : t)));
      } else {
        toast.error(result.error);
      }
    });
  }

  const isEmpty = !initialLoad && !isFetching && tasks.length === 0;
  const hasMore = !!nextCursor;
  const showSkeleton = initialLoad || (isFetching && tasks.length === 0);
  const trimmedSearch = search.trim();
  const hasSearch = trimmedSearch !== "";

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

      <div className="flex flex-col min-w-0">
        {showSkeleton ? (
          view === "list" ? <TaskListSkeleton count={8} /> : <TaskCardSkeleton count={6} />
        ) : isEmpty ? (
          <TaskEmptyState
            orgId={orgId}
            canManageTasks={canManageTasks}
            hasSearch={hasSearch}
            trimmedSearch={trimmedSearch}
          />
        ) : (
          view === "list" ? (
            <TaskListView
              orgId={orgId}
              tasks={tasks}
              canManageTasks={canManageTasks}
              isPending={isPending}
              onAddToList={handleAddToList}
              onDeleteClick={handleDeleteClick}
            />
          ) : (
            <TaskCardGrid
              orgId={orgId}
              tasks={tasks}
              canManageTasks={canManageTasks}
              isPending={isPending}
              onAddToList={handleAddToList}
              onDeleteClick={handleDeleteClick}
            />
          )
        )}

        <div ref={sentinelRef} className="h-1" aria-hidden />

        {isFetching && !initialLoad && !hasMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <TaskRemoveDialog
        orgId={orgId}
        task={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onRemoveFromList={handleRemoveFromList}
        onDelete={handleDelete}
      />
    </>
  );
}