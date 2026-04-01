"use client";

/**
 * Interactive task table for the Tasks list page.
 *
 * Receives all org tasks (with role eligibility) and roles from the server page.
 * All filtering, sorting, and row actions happen client-side — no additional
 * network requests until a mutation is triggered.
 *
 * Toolbar:
 *  - Search input — filters rows by title (case-insensitive).
 *  - Sort dropdown — Name A–Z/Z–A, Duration ↑↓, People ↑↓.
 *  - Filter by role — hidden when no roles exist; highlights when active.
 *  - Actions dropdown — single "Create" link to the new-task form.
 *
 * Row actions ([...] menu per row):
 *  - Edit — navigates to `/orgs/[orgId]/tasks/[taskId]/edit`.
 *  - Duplicate — navigates to `/orgs/[orgId]/tasks/new?duplicateFrom=[taskId]`.
 *  - Delete — opens an AlertDialog for confirmation, then calls `deleteTaskAction`.
 *
 * Clicking anywhere else on a row navigates to the task detail page.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toolbar } from "@/components/layout/toolbar";
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
import { deleteTaskAction } from "@/app/actions/tasks";

// ─── Types ────────────────────────────────────────────────────────────────────

type Task = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  minPeople: number;
  eligibility: { role: { id: string; name: string; color: string | null } }[];
};

type Role = { id: string; name: string };

type SortOption =
  | "name-asc"
  | "name-desc"
  | "duration-asc"
  | "duration-desc"
  | "people-asc"
  | "people-desc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "duration-asc", label: "Duration ↑" },
  { value: "duration-desc", label: "Duration ↓" },
  { value: "people-asc", label: "People ↑" },
  { value: "people-desc", label: "People ↓" },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface TaskTableProps {
  orgId: string;
  tasks: Task[];
  roles: Role[];
  canManageTasks: boolean;
}

export function TaskTable({ orgId, tasks, roles, canManageTasks }: TaskTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("name-asc");
  const [filterRoleId, setFilterRoleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  // Filter by search and role
  let visible = tasks.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );
  if (filterRoleId) {
    visible = visible.filter((t) =>
      t.eligibility.some((e) => e.role.id === filterRoleId),
    );
  }

  // Sort
  visible = [...visible].sort((a, b) => {
    switch (sort) {
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "duration-asc":
        return a.durationMin - b.durationMin;
      case "duration-desc":
        return b.durationMin - a.durationMin;
      case "people-asc":
        return a.minPeople - b.minPeople;
      case "people-desc":
        return b.minPeople - a.minPeople;
    }
  });

  const activeSort = SORT_OPTIONS.find((o) => o.value === sort)!;
  const activeRole = roles.find((r) => r.id === filterRoleId);

  function handleDelete() {
    if (!deleteTarget) return;
    const taskId = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteTaskAction(orgId, taskId);
      if (result.ok) {
        toast.success("Task deleted.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Toolbar actions={canManageTasks ? [{ label: "Create", href: `/orgs/${orgId}/tasks/new` }] : undefined}>
        <Input
          aria-label="Search tasks by title"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-8"
        />

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
              {activeSort.label}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {SORT_OPTIONS.map((o) => (
              <DropdownMenuItem key={o.value} onClick={() => setSort(o.value)}>
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filter by role */}
        {roles.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={filterRoleId ? "secondary" : "outline"}
                size="sm"
                className="gap-1.5 shrink-0"
              >
                {activeRole ? activeRole.name : "Filter by role"}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {filterRoleId && (
                <DropdownMenuItem onClick={() => setFilterRoleId(null)}>
                  All roles
                </DropdownMenuItem>
              )}
              {roles.map((r) => (
                <DropdownMenuItem
                  key={r.id}
                  onClick={() => setFilterRoleId(r.id)}
                >
                  {r.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Toolbar>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tasks.length === 0
            ? "No tasks yet."
            : "No tasks match your filters."}
        </p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Title</th>
                <th className="text-left px-4 py-2.5 font-medium">
                  Description
                </th>
                <th className="text-left px-4 py-2.5 font-medium">Duration</th>
                <th className="text-left px-4 py-2.5 font-medium">People</th>
                <th className="text-left px-4 py-2.5 font-medium">Role</th>
                {canManageTasks && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => (
                <tr
                  key={task.id}
                  tabIndex={0}
                  onClick={() => router.push(`/orgs/${orgId}/tasks/${task.id}`)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    if (e.target !== e.currentTarget) return;
                    router.push(`/orgs/${orgId}/tasks/${task.id}`);
                  }}
                  className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <td className="px-4 py-3 font-medium">{task.name}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-60 truncate">
                    {task.description ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {task.durationMin} min
                  </td>
                  <td className="px-4 py-3 tabular-nums">{task.minPeople}</td>
                  <td className="px-4 py-3">
                    {task.eligibility.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {task.eligibility.map((e) => (
                          <span
                            key={e.role.id}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted"
                          >
                            {e.role.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  {canManageTasks && (
                  <td
                    className="px-2 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={isPending}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Task actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/orgs/${orgId}/tasks/${task.id}/edit`)
                          }
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
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
                          onClick={() => setDeleteTarget(task)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium">{deleteTarget?.name}</span>? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
