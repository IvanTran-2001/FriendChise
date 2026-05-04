import type { ReactNode } from "react";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { TasksSidebarShell } from "./_components/tasks-sidebar-shell";

export default function TasksLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RegisterPageSidebar content={<TasksSidebarShell />} />
      {children}
    </>
  );
}
