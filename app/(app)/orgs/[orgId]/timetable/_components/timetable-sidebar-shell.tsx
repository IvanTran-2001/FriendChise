"use client";

/**
 * TimetableSidebarShell — shared wrapper for the timetable page sidebar.
 *
 * Renders the fixed nav tabs (Timetable / Templates) at the top. Page-specific
 * sub-content (filters, actions) is read from PageSidebarCtx via
 * `usePageSidebarSubContent()` so the shell stays mounted during navigation
 * between timetable routes — eliminating sidebar flicker.
 */
import { useParams, usePathname } from "next/navigation";
import { Calendar, LayoutList } from "lucide-react";
import { PageSidebarNavItem } from "@/components/layout/page-sidebar-nav-item";
import { usePageSidebarSubContent } from "@/components/layout/page-sidebar-context";

const tabs = [
  {
    label: "Schedule",
    icon: Calendar,
    href: (orgId: string) => `/orgs/${orgId}/timetable`,
    exact: true,
  },
  {
    label: "Templates",
    icon: LayoutList,
    href: (orgId: string) => `/orgs/${orgId}/timetable/templates`,
    exact: false,
  },
];

export function TimetableSidebarShell() {
  const { orgId } = useParams<{ orgId: string }>();
  const pathname = usePathname();
  const subContent = usePageSidebarSubContent();

  return (
    <aside className="flex flex-col flex-1 overflow-y-auto">
      {/* Nav tabs */}
      <nav className="shrink-0 border-b border-border">
        {tabs.map(({ label, icon: Icon, href, exact }) => {
          const url = href(orgId);
          const isActive = exact ? pathname === url : pathname.startsWith(url);
          return (
            <PageSidebarNavItem
              key={label}
              title={label}
              url={url}
              icon={Icon}
              isActive={isActive}
            />
          );
        })}
      </nav>

      {/* Page-specific sub-content (filters, actions, etc.) */}
      {subContent}
    </aside>
  );
}
