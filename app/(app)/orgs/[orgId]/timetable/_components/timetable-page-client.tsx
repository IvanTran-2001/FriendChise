"use client";

import { useState } from "react";

import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import type { TemplateOption } from "./apply-template-dialog";
import type { SharedTask } from "../_shared/types";
import type { ClientMembership, ClientTimetableInstance } from "../timetable-client";
import { TimetableClient } from "../timetable-client";
import { TimetableSidebarContent } from "./timetable-sidebar-content";

type Role = { id: string; name: string; color: string | null };
type Tag = { id: string; name: string; color: string };

interface TimetablePageClientProps {
  orgId: string;
  instances: ClientTimetableInstance[];
  anchor: string;
  openTimeMin: number;
  closeTimeMin: number;
  initialMode: "calendar" | "simple";
  initialSpan: "day" | "week";
  fillHeight?: boolean;
  todayStr: string;
  selectedRoleId: string | null;
  selectedTagId: string | null;
  roles: Role[];
  tags: Tag[];
  canManage: boolean;
  templates: TemplateOption[];
  userId?: string;
  tasks?: SharedTask[];
  taskColors: Record<
    string,
    { color: string | null; roleColor: string | null; tagColor: string | null }
  >;
  memberships?: ClientMembership[];
  isModeExplicit: boolean;
  isSpanExplicit: boolean;
  isFiltersExplicit: boolean;
}

export function TimetablePageClient({
  orgId,
  instances,
  anchor,
  openTimeMin,
  closeTimeMin,
  initialMode,
  initialSpan,
  fillHeight,
  todayStr,
  selectedRoleId,
  selectedTagId,
  roles,
  tags,
  canManage,
  templates,
  userId,
  tasks,
  taskColors,
  memberships,
  isModeExplicit,
  isSpanExplicit,
  isFiltersExplicit,
}: TimetablePageClientProps) {
  const [currentMode, setCurrentMode] = useState<"calendar" | "simple">(initialMode);
  const [currentSpan, setCurrentSpan] = useState<"day" | "week">(initialSpan);

  return (
    <>
      <RegisterPageSidebarSubContent
        content={
          <TimetableSidebarContent
            orgId={orgId}
            anchor={anchor}
            mode={currentMode}
            span={currentSpan}
            selectedRoleId={selectedRoleId}
            roles={roles}
            tags={tags}
            selectedTagId={selectedTagId}
            canManage={canManage}
            templates={templates}
            todayStr={todayStr}
            userId={userId}
            tasks={tasks}
            isModeExplicit={isModeExplicit}
            isSpanExplicit={isSpanExplicit}
            isFiltersExplicit={isFiltersExplicit}
            onModeChange={setCurrentMode}
            onSpanChange={setCurrentSpan}
          />
        }
      />

      <TimetableClient
        orgId={orgId}
        instances={instances}
        anchor={anchor}
        openTimeMin={openTimeMin}
        closeTimeMin={closeTimeMin}
        mode={currentMode}
        span={currentSpan}
        fillHeight={fillHeight}
        todayStr={todayStr}
        roleId={selectedRoleId}
        tagId={selectedTagId}
        canManage={canManage}
        userId={userId}
        availableTasks={tasks}
        taskColors={taskColors}
        memberships={memberships}
      />
    </>
  );
}