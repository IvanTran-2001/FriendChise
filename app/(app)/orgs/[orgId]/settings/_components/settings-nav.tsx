"use client";

/**
 * SettingsNav — page sidebar content for settings routes.
 *
 * Shown inside `PageSidebarSlot` for all routes under `/orgs/[orgId]/settings`.
 * Links to Organization, Roles, Timetable, and Notification settings. Active
 * item is highlighted via prefix-match against the current pathname.
 */
import { useParams, usePathname } from "next/navigation";
import { Building2, ShieldCheck, Calendar, Bell } from "lucide-react";
import { SidebarNavItem } from "@/components/layout/sidebar-nav-item";

export function SettingsNav() {
  const { orgId } = useParams<{ orgId: string }>();
  const pathname = usePathname();

  const items = [
    {
      title: "Organization",
      url: `/orgs/${orgId}/settings/organization`,
      icon: Building2,
      disabled: false,
    },
    {
      title: "Roles",
      url: `/orgs/${orgId}/settings/roles`,
      icon: ShieldCheck,
      disabled: false,
    },
    {
      title: "Timetable",
      url: `/orgs/${orgId}/settings/timetable`,
      icon: Calendar,
      disabled: true,
    },
    {
      title: "Notification",
      url: `/orgs/${orgId}/settings/notification`,
      icon: Bell,
      disabled: true,
    },
  ];

  return (
    <aside className="flex flex-col flex-1 overflow-y-auto">
      <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          Settings
        </span>
      </div>
      {items.map(({ title, url, icon, disabled }) => (
        <SidebarNavItem
          key={url}
          title={title}
          url={url}
          icon={icon}
          disabled={disabled}
          isActive={pathname === url || pathname.startsWith(`${url}/`)}
        />
      ))}
    </aside>
  );
}
