"use client";

/**
 * OrgManagementNav — page sidebar content for org-management routes.
 *
 * Shown inside `PageSidebarSlot` for all routes under `/orgs/(organizations)`.
 * Contains links to Create, Join, Invite, and List org actions. Items marked
 * `disabled` are rendered as non-interactive (coming-soon stubs).
 */
import { usePathname } from "next/navigation";
import { Building2, PlusCircle, Network, Mail } from "lucide-react";
import { SidebarNavItem } from "@/components/layout/sidebar-nav-item";

const items = [
  { title: "Create", url: "/orgs/new", icon: PlusCircle, disabled: false },
  { title: "Join", url: "/orgs/join", icon: Network, disabled: false },
  { title: "Invite", url: "/orgs/invite", icon: Mail, disabled: true },
  { title: "List", url: "/orgs", icon: Building2, disabled: true },
];

export function OrgManagementNav() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col flex-1 overflow-y-auto">
      <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">Organizations</span>
      </div>
      {items.map(({ title, url, icon, disabled }) => (
        <SidebarNavItem
          key={url}
          title={title}
          url={url}
          icon={icon}
          disabled={disabled}
          isActive={pathname === url}
        />
      ))}
    </aside>
  );
}
