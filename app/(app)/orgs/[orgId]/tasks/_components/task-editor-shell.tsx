"use client";

/**
 * Shared task editor shell.
 *
 * The create and edit pages both register sidebar content, toolbar actions,
 * and the main form body through this wrapper so their page chrome stays in
 * sync while the field logic remains separate.
 */

import type { ReactNode } from "react";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";

interface TaskEditorShellProps {
  sidebarContent: ReactNode;
  toolbarContent: ReactNode;
  children: ReactNode;
}

export function TaskEditorShell({
  sidebarContent,
  toolbarContent,
  children,
}: TaskEditorShellProps) {
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