"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { LayoutDashboard, Building2, ListTodo, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const baseNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Organizations", url: "/orgs", icon: Building2 },
];

function getOrgNavItems(orgId: string) {
  return [
    { title: "Overview", url: `/orgs/${orgId}`, icon: Building2 },
    { title: "Tasks", url: `/orgs/${orgId}/tasks`, icon: ListTodo },
    { title: "Members", url: `/orgs/${orgId}/memberships`, icon: Users },
  ];
}

export function AppSidebar() {
  const { orgId } = useParams<{ orgId?: string }>();

  const navItems = orgId ? getOrgNavItems(orgId) : baseNavItems;
  const groupLabel = orgId ? "Organization" : "Navigation";

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-4 py-3">
        <Link href="/" className="font-semibold text-sm">Management App</Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
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
    </Sidebar>
  );
}
