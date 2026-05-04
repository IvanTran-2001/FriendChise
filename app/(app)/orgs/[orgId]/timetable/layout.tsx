import type { ReactNode } from "react";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { TimetableSidebarShell } from "./_components/timetable-sidebar-shell";

/**
 * Timetable section layout — registers the shared TimetableSidebarShell once
 * for all timetable routes (main page, templates, etc.).
 *
 * Because this layout persists across navigation within the timetable section,
 * the sidebar shell (nav tabs) stays mounted and never flickers. Individual
 * pages register only their page-specific sub-content via
 * RegisterPageSidebarSubContent.
 */
export default function TimetableLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RegisterPageSidebar content={<TimetableSidebarShell />} />
      {children}
    </>
  );
}
