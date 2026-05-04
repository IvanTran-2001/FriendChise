"use client";

/**
 * TimetableSidebarShell — shared wrapper for the timetable page sidebar.
 *
 * Renders the fixed nav tabs (Timetable / Templates) at the top. Page-specific
 * sub-content (filters, actions) is read from PageSidebarCtx via
 * `usePageSidebarSubContent()` so the shell stays mounted during navigation
 * between timetable routes — eliminating sidebar flicker.
 */
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Calendar, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageSidebarSubContent } from "@/components/layout/page-sidebar-context";

const tabs = [
  { label: "Schedule", icon: Calendar, href: (orgId: string) => `/orgs/${orgId}/timetable`, exact: true },
  { label: "Templates", icon: LayoutList, href: (orgId: string) => `/orgs/${orgId}/timetable/templates`, exact: false },
];

export function TimetableSidebarShell() {
  const { orgId } = useParams<{ orgId: string }>();
  const pathname = usePathname();
  const subContent = usePageSidebarSubContent();

  return (
    <aside className="flex flex-col flex-1 overflow-y-auto">
      {/* Panel title */}
      <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          Timetable
        </span>
      </div>

      {/* Nav tabs */}
      <nav className="shrink-0 border-b border-border">
        {tabs.map(({ label, icon: Icon, href, exact }) => {
          const url = href(orgId);
          const isActive = exact ? pathname === url : pathname.startsWith(url);
          return (
            <Link
              key={label}
              href={url}
              className={cn(
                "flex items-center gap-2.5 h-12 px-4 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Page-specific sub-content (filters, actions, etc.) */}
      {subContent}
    </aside>
  );
}
