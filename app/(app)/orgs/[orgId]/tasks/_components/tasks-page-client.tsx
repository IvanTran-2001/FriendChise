"use client";

import { useState } from "react";

import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { TaskTable } from "./task-table";
import { TasksSidebarContent } from "./tasks-sidebar-content";
import type { SortOption } from "./tasks-config";

type Role = { id: string; name: string; color?: string | null };
type Tag = { id: string; name: string; color: string };

interface TasksPageClientProps {
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
  initialTasks: Parameters<typeof TaskTable>[0]["initialTasks"];
  initialNextCursor: string | null;
}

export function TasksPageClient({
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
  initialTasks,
  initialNextCursor,
}: TasksPageClientProps) {
  const [currentView, setCurrentView] = useState<"list" | "card">(view);
  const [currentMode, setCurrentMode] = useState<"list" | "shared" | "available">(mode);

  return (
    <>
      <RegisterPageSidebarSubContent
        content={
          <TasksSidebarContent
            orgId={orgId}
            roles={roles}
            tags={tags}
            canManageTasks={canManageTasks}
            sort={sort}
            roleId={roleId}
            tagId={tagId}
            view={currentView}
            mode={currentMode}
            isModeExplicit={isModeExplicit}
            isFiltersExplicit={isFiltersExplicit}
            onViewChange={setCurrentView}
            onModeChange={setCurrentMode}
          />
        }
      />
      <TaskTable
        orgId={orgId}
        mode={currentMode}
        canManageTasks={canManageTasks}
        sort={sort}
        filterRoleId={roleId}
        filterTagId={tagId}
        view={currentView}
        initialTasks={initialTasks}
        initialNextCursor={initialNextCursor}
      />
    </>
  );
}