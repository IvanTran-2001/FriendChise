"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ListTodo,
  Users,
  Calendar,
  BarChart2,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

/**
 * Nav items shown when the user is not inside a specific org (e.g. on the home page).
 * To add a global page, append an entry here.
 */
const baseNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Organizations", url: "/orgs", icon: Building2 },
];

/**
 * Nav items shown when the user is inside an org (any /orgs/[orgId]/... route).
 * To add a new org-scoped page, append an entry here and add the corresponding
 * route under app/(app)/orgs/[orgId]/.
 */
function getOrgNavItems(orgId: string) {
  return [
    { title: "Overview", url: `/orgs/${orgId}`, icon: Building2 },
    { title: "Timetable", url: `/orgs/${orgId}/timetable`, icon: Calendar },
    { title: "Tasks", url: `/orgs/${orgId}/tasks`, icon: ListTodo },
    { title: "Members", url: `/orgs/${orgId}/memberships`, icon: Users },
    { title: "Progress", url: `/orgs/${orgId}/progress`, icon: BarChart2 },
  ];
}

/**
 * Nav items pinned to the bottom of the sidebar when inside an org.
 * Separated from the main nav by a dashed divider.
 * To add more footer items, append an entry here.
 */
function getOrgFooterItems(orgId: string) {
  return [
    { title: "Settings", url: `/orgs/${orgId}/settings`, icon: Settings },
  ];
}

/**
 * Collapsible sidebar rendered in the app layout.
 *
 * Behaviour:
 * - Outside an org: shows global nav (Dashboard, Organizations).
 * - Inside an org: switches to org-scoped nav and shows footer items (e.g. Settings).
 * - Active page is highlighted via `isActive`, derived from the current pathname.
 */
export function AppSidebar() {
  // orgId is present on any /orgs/[orgId]/... route, undefined otherwise
  const { orgId } = useParams<{ orgId?: string }>();
  // Used to determine which nav item should be marked active
  const pathname = usePathname();

  const navItems = orgId ? getOrgNavItems(orgId) : baseNavItems;
  const footerItems = orgId ? getOrgFooterItems(orgId) : [];

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-4 py-3">
        <Link href="/" className="font-semibold text-sm">
          Management App
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer items pinned to the bottom, only inside an org */}
      {footerItems.length > 0 && (
        <>
          <SidebarSeparator className="border-dashed" />
          <SidebarFooter>
            <SidebarMenu>
              {footerItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarFooter>
        </>
      )}
    </Sidebar>
  );
}
