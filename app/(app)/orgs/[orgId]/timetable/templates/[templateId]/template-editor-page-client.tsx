"use client";

import { useState } from "react";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { TemplateEditorSidebarContent } from "./_components/template-editor-sidebar-content";
import {
  TemplateEditorClient,
  type ClientMembership,
  type ClientTask,
  type ClientTemplateInstance,
} from "./index";

interface TemplateEditorPageClientProps {
  orgId: string;
  templateId: string;
  templateDays: number;
  instances: ClientTemplateInstance[];
  availableTasks: ClientTask[];
  taskColors: Record<
    string,
    { color: string | null; roleColor: string | null; tagColor: string | null }
  >;
  memberships: ClientMembership[];
  todayStr: string;
  openTimeMin: number;
  closeTimeMin: number;
  mode: "calendar" | "simple";
  span: "day" | "week";
  calendarHref: string;
  simpleHref: string;
  dayHref: string;
  weekHref: string;
}

export function TemplateEditorPageClient({
  orgId,
  templateId,
  templateDays,
  instances,
  availableTasks,
  taskColors,
  memberships,
  todayStr,
  openTimeMin,
  closeTimeMin,
  mode: initialMode,
  span: initialSpan,
  calendarHref,
  simpleHref,
  dayHref,
  weekHref,
}: TemplateEditorPageClientProps) {
  const [mode, setMode] = useState<"calendar" | "simple">(initialMode);
  const [span, setSpan] = useState<"day" | "week">(initialSpan);

  return (
    <>
      <RegisterPageSidebarSubContent
        content={
          <TemplateEditorSidebarContent
            orgId={orgId}
            templateId={templateId}
            templateDays={templateDays}
            mode={mode}
            span={span}
            calendarHref={calendarHref}
            simpleHref={simpleHref}
            dayHref={dayHref}
            weekHref={weekHref}
            onModeChange={setMode}
            onSpanChange={setSpan}
            availableTasks={availableTasks}
          />
        }
      />

      <TemplateEditorClient
        title={<></>}
        orgId={orgId}
        templateId={templateId}
        templateDays={templateDays}
        instances={instances}
        availableTasks={availableTasks}
        taskColors={taskColors}
        memberships={memberships}
        todayStr={todayStr}
        openTimeMin={openTimeMin}
        closeTimeMin={closeTimeMin}
        mode={mode}
        span={span}
        fillHeight
      />
    </>
  );
}