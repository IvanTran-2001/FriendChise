import type { ReactNode } from "react";
import { RegisterPageSidebar } from "@/components/layout/contexts/page-sidebar-context";
import { TimetableSidebarShell } from "./_components/timetable-sidebar-shell";
import { TimetableZoomProviderWrapper } from "./_components/timetable-zoom-provider-wrapper";

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
    <TimetableZoomProviderWrapper>
      <RegisterPageSidebar title="Timetable" content={<TimetableSidebarShell />} />
      {children}
    </TimetableZoomProviderWrapper>
  );
}
