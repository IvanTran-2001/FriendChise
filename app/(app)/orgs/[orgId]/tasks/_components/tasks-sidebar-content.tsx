"use client";

/**
 * TasksSidebarContent — page sidebar for the tasks list page.
 *
 * Sections:
 *  - Mode nav — three views of the task library:
 *      All       (mode=shared)    tasks the org inherited + available franchise tasks
 *      My Tasks  (mode=list)      only tasks the org has actively inherited
 *      Shared    (mode=available) only franchise GLOBAL tasks not yet inherited
 *  - Filters — sort order, role filter, tag filter, list/card view toggle
 *  - Actions — Create Task link (canManageTasks only)
 *
 * All mode/filter/sort/view state is URL-driven: each control pushes a new URL
 * so the server page re-renders with updated params. The last-used mode and prefs
 * are persisted to both localStorage and cookies. Cookies allow the server page to
 * perform a redirect before render (no client round-trip); localStorage keeps prefs
 * alive across browser sessions when cookies have not yet been set.
 */
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  ChevronDown,
  Globe,
  LayoutGrid,
  List,
  ListTodo,
  Plus,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SidebarNavItem } from "@/components/layout/sidebar-nav-item";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TagFilterButton } from "@/components/ui/tag-filter-button";
import { SORT_OPTIONS, type SortOption } from "./tasks-config";

type Role = { id: string; name: string };
type Tag = { id: string; name: string; color: string };

interface TasksSidebarContentProps {
  orgId: string;
  roles: Role[];
  tags: Tag[];
  canManageTasks: boolean;
  sort: SortOption;
  roleId: string | null;
  tagId: string | null;
  view: "list" | "card";
  mode: "list" | "shared" | "available";
  isModeExplicit: boolean;
  isFiltersExplicit: boolean;
}

export function TasksSidebarContent({
  orgId,
  roles,
  tags,
  canManageTasks,
  sort,
  roleId,
  tagId,
  view,
  mode,
  isModeExplicit,
  isFiltersExplicit,
}: TasksSidebarContentProps) {
  const router = useRouter();

  const TASKS_MODE_KEY = `tasks-mode-${orgId}`;
  const TASKS_PREFS_KEY = `tasks-prefs-${orgId}`;
  const isFirstRender = useRef(true);

  function setTasksCookie(key: string, value: string) {
    try {
      document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch { /* ignore */ }
  }

  // On mount: restore saved mode and/or filter prefs if URL has no explicit params
  useEffect(() => {
    const overrides: Parameters<typeof buildHref>[0] = {};
    if (!isModeExplicit) {
      const savedMode = localStorage.getItem(TASKS_MODE_KEY);
      if (
        (savedMode === "list" || savedMode === "available") &&
        mode !== savedMode
      ) {
        overrides.mode = savedMode as "list" | "available";
      }
    }
    if (!isFiltersExplicit) {
      try {
        const raw = localStorage.getItem(TASKS_PREFS_KEY);
        if (raw) {
          const prefs = JSON.parse(raw) as {
            sort?: string;
            roleId?: string | null;
            tagId?: string | null;
            view?: string;
          };
          if (
            prefs.sort &&
            SORT_OPTIONS.some((o) => o.value === prefs.sort) &&
            prefs.sort !== sort
          ) {
            overrides.sort = prefs.sort as SortOption;
          }
          if (typeof prefs.roleId === "string" && prefs.roleId !== roleId) {
            // Only restore roleId if it exists in current roles list
            if (roles.find((r) => r.id === prefs.roleId)) {
              overrides.roleId = prefs.roleId;
            }
          }
          if (typeof prefs.tagId === "string" && prefs.tagId !== tagId) {
            // Only restore tagId if it exists in current tags list
            if (tags.find((t) => t.id === prefs.tagId)) {
              overrides.tagId = prefs.tagId;
            }
          }
          if (
            (prefs.view === "card" || prefs.view === "list") &&
            prefs.view !== view
          ) {
            overrides.view = prefs.view as "card" | "list";
          }
        }
      } catch {
        // Ignore localStorage errors
      }
    }
    if (Object.keys(overrides).length > 0) {
      router.replace(buildHref(overrides));
    }
    // Seed cookies so the server can restore prefs without a client-side round-trip
    // on the next bare navigation (no URL params). This is a one-time migration for
    // users who have localStorage data but no cookie yet.
    const resolvedMode = (overrides.mode ?? mode) as string;
    const resolvedPrefs = JSON.stringify({
      sort: overrides.sort ?? sort,
      roleId: overrides.roleId !== undefined ? overrides.roleId : roleId,
      tagId: overrides.tagId !== undefined ? overrides.tagId : tagId,
      view: overrides.view ?? view,
    });
    setTasksCookie(TASKS_MODE_KEY, resolvedMode);
    setTasksCookie(TASKS_PREFS_KEY, resolvedPrefs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save filter prefs whenever they change (skip first render to avoid stomping saved prefs)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const prefsJson = JSON.stringify({ sort, roleId, tagId, view });
    try {
      localStorage.setItem(`tasks-prefs-${orgId}`, prefsJson);
    } catch { /* ignore */ }
    setTasksCookie(TASKS_PREFS_KEY, prefsJson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, roleId, tagId, view]);

  function buildHref(overrides: {
    sort?: SortOption;
    roleId?: string | null;
    tagId?: string | null;
    view?: "list" | "card";
    mode?: "list" | "shared" | "available";
  }) {
    const params = new URLSearchParams();
    const next = { sort, roleId, tagId, view, mode, ...overrides };
    if (next.sort && next.sort !== "name-asc") params.set("sort", next.sort);
    if (next.roleId) params.set("roleId", next.roleId);
    if (next.tagId) params.set("tagId", next.tagId);
    if (next.view && next.view !== "list") params.set("view", next.view);
    if (
      next.mode === "list" ||
      next.mode === "available" ||
      (next.mode === "shared" && isModeExplicit)
    ) {
      params.set("mode", next.mode);
    }
    const qs = params.toString();
    return `/orgs/${orgId}/tasks${qs ? `?${qs}` : ""}`;
  }

  const activeSort = SORT_OPTIONS.find((o) => o.value === sort)!;
  const activeRole = roles.find((r) => r.id === roleId);

  return (
    <>
      {/* Mode nav items */}
      <div>
        <SidebarNavItem
          title="All"
          url={buildHref({ mode: "shared" })}
          icon={Globe}
          isActive={mode === "shared"}
          onClick={() => {
            localStorage.setItem(TASKS_MODE_KEY, "shared");
            setTasksCookie(TASKS_MODE_KEY, "shared");
          }}
        />
        <SidebarNavItem
          title="My Tasks"
          url={buildHref({ mode: "list" })}
          icon={ListTodo}
          isActive={mode === "list"}
          onClick={() => {
            localStorage.setItem(TASKS_MODE_KEY, "list");
            setTasksCookie(TASKS_MODE_KEY, "list");
          }}
        />
        <SidebarNavItem
          title="Shared"
          url={buildHref({ mode: "available" })}
          icon={Share2}
          isActive={mode === "available"}
          onClick={() => {
            localStorage.setItem(TASKS_MODE_KEY, "available");
            setTasksCookie(TASKS_MODE_KEY, "available");
          }}
        />
      </div>

      <div className="px-3 pt-3 pb-2 border-t border-border">
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

          {/* Tag filter */}
          {tags.length > 0 && (
            <TagFilterButton
              tags={tags}
              selectedTagId={tagId}
              basePath={`/orgs/${orgId}/tasks`}
              extraParams={{
                ...(sort !== "name-asc" ? { sort } : {}),
                ...(roleId ? { roleId } : {}),
                ...(view !== "list" ? { view } : {}),
                ...(mode === "list"
                  ? { mode: "list" }
                  : mode === "available"
                    ? { mode: "available" }
                    : {}),
              }}
            />
          )}

          {/* View toggle */}
          <SegmentedControl
            size="sm"
            className="w-fit"
            value={view}
            onChange={(v) => {
              const newView = v as "list" | "card";
              // Update cookie before navigating so the server-side redirect
              // doesn't restore the old view when the URL has no ?view param
              const newPrefs = JSON.stringify({ sort, roleId, tagId, view: newView });
              try { localStorage.setItem(TASKS_PREFS_KEY, newPrefs); } catch { /* ignore */ }
              setTasksCookie(TASKS_PREFS_KEY, newPrefs);
              router.push(buildHref({ view: newView }));
            }}
            options={[
              { value: "list", label: <List className="h-4 w-4" /> },
              { value: "card", label: <LayoutGrid className="h-4 w-4" /> },
            ]}
          />
        </div>
      </div>

      {canManageTasks && mode === "list" && (
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
