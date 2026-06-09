"use client";

import type { ReactNode } from "react";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";

interface TaskEditorFrameProps {
  sidebarContent: ReactNode;
  toolbarContent: ReactNode;
  children: ReactNode;
}

export function TaskEditorFrame({
  sidebarContent,
  toolbarContent,
  children,
}: TaskEditorFrameProps) {
  return (
    <>
      <RegisterPageSidebarSubContent content={sidebarContent} />
      <RegisterPageToolbar>{toolbarContent}</RegisterPageToolbar>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {children}
      </div>
    </>
  );
}