"use client";

/**
 * TasksSidebarContent — page sidebar for the tasks list page.
 *
 * Sections:
 *  - Filters — sort order, role filter, list/card view toggle
 *  - Actions — Create Task link (canManageTasks only)
 *
 * All filter/sort/view state is URL-driven: each control pushes a new URL so
 * the server page re-renders with the updated params. This keeps the sidebar
 * and the task table in sync without a shared client context.
 */
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SORT_OPTIONS, type SortOption } from "./tasks-config";

type Role = { id: string; name: string };

interface TasksSidebarContentProps {
  orgId: string;
  roles: Role[];
  canManageTasks: boolean;
  sort: SortOption;
  roleId: string | null;
  view: "list" | "card";
}

export function TasksSidebarContent({
  orgId,
  roles,
  canManageTasks,
  sort,
  roleId,
  view,
}: TasksSidebarContentProps) {
  const router = useRouter();

  function buildHref(overrides: {
    sort?: SortOption;
    roleId?: string | null;
    view?: "list" | "card";
  }) {
    const params = new URLSearchParams();
    const next = { sort, roleId, view, ...overrides };
    if (next.sort && next.sort !== "name-asc") params.set("sort", next.sort);
    if (next.roleId) params.set("roleId", next.roleId);
    if (next.view && next.view !== "list") params.set("view", next.view);
    const qs = params.toString();
    return `/orgs/${orgId}/tasks${qs ? `?${qs}` : ""}`;
  }

  const activeSort = SORT_OPTIONS.find((o) => o.value === sort)!;
  const activeRole = roles.find((r) => r.id === roleId);

  return (
    <>
      {/* Filters section */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          Filters
        </p>
        <div className="flex flex-col gap-2">

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between gap-2"
            >
              {activeSort.label}
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-40">
            {SORT_OPTIONS.map((o) => (
              <DropdownMenuItem
                key={o.value}
                onClick={() => router.push(buildHref({ sort: o.value }))}
              >
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Role filter */}
        {roles.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={roleId ? "secondary" : "outline"}
                size="sm"
                className="w-full justify-between gap-2"
                aria-label="Filter by role"
              >
                {activeRole ? activeRole.name : "All roles"}
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40">
              {roleId && (
                <DropdownMenuItem
                  onClick={() => router.push(buildHref({ roleId: null }))}
                >
                  All roles
                </DropdownMenuItem>
              )}
              {roles.map((r) => (
                <DropdownMenuItem
                  key={r.id}
                  onClick={() => router.push(buildHref({ roleId: r.id }))}
                >
                  {r.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* View toggle */}
        <SegmentedControl
          size="sm"
          className="w-fit"
          value={view}
          onChange={(v) => router.push(buildHref({ view: v as "list" | "card" }))}
          options={[
            { value: "list", label: <List className="h-4 w-4" /> },
            { value: "card", label: <LayoutGrid className="h-4 w-4" /> },
          ]}
        />
        </div>
      </div>

      {canManageTasks && (
        <div className="px-3 pt-2 pb-3 border-t border-border">
          <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
            Actions
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild size="sm" className="w-full justify-start gap-2">
              <Link href={`/orgs/${orgId}/tasks/new`}>
                <Plus className="h-4 w-4" />
                Create Task
              </Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
