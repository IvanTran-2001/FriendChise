"use client";

import { useState, useEffect } from "react";
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
  PlusCircle,
  Mail,
  HelpCircle,
  BookOpen,
  Info,
  Phone,
  ChevronRight,
  ChevronLeft,
  ListCheckIcon,
  ShieldCheck,
  Bell,
  Network,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/**
 * A collapsible nav section with a chevron toggle.
 * Used in the global (no-org) sidebar for the Organizations and Help groups.
 */
function NavCollapsible({
  icon: Icon,
  label,
  defaultOpen = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const subMenuId = `sidebar-section-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={subMenuId}
      >
        <Icon />
        <span>{label}</span>
        <ChevronRight
          className={cn(
            "ml-auto transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </SidebarMenuButton>
      {open && <SidebarMenuSub id={subMenuId}>{children}</SidebarMenuSub>}
    </SidebarMenuItem>
  );
}

function getOrgItems(orgId: string) {
  return [
    { title: "Overview", url: `/orgs/${orgId}`, icon: Building2 },
    { title: "Timetable", url: `/orgs/${orgId}/timetable`, icon: Calendar },
    { title: "Tasks", url: `/orgs/${orgId}/tasks`, icon: ListTodo },
    { title: "Members", url: `/orgs/${orgId}/memberships`, icon: Users },
    { title: "Progress", url: `/orgs/${orgId}/progress`, icon: BarChart2 },
  ];
}

function getSettingsItems(orgId: string) {
  return [
    { title: "Back to Org", url: `/orgs/${orgId}`, icon: ChevronLeft },
    {
      title: "Organization",
      url: `/orgs/${orgId}/settings/organization`,
      icon: Building2,
    },
    { title: "Roles", url: `/orgs/${orgId}/settings/roles`, icon: ShieldCheck },
    {
      title: "Timetable",
      url: `/orgs/${orgId}/settings/timetable`,
      icon: Calendar,
    },
    {
      title: "Notification",
      url: `/orgs/${orgId}/settings/notification`,
      icon: Bell,
    },
  ];
}

/**
 * Returns the correct nav items for the current org context.
 * Derives the active mode from pathname so the component doesn't need to.
 */
function getNavItems(orgId: string, pathname: string) {
  if (pathname.startsWith(`/orgs/${orgId}/settings`))
    return getSettingsItems(orgId);
  return getOrgItems(orgId);
}

/**
 * Returns footer items (e.g. Settings) when inside an org but not in settings.
 * Empty array otherwise so the footer is hidden.
 */
function getFooterItems(orgId: string, pathname: string, isParentOwner: boolean) {
  if (pathname.startsWith(`/orgs/${orgId}/settings`)) return [];
  return [
    ...(isParentOwner
      ? [{ title: "Franchisee", url: `/orgs/${orgId}/franchisee`, icon: Network }]
      : []),
    { title: "Settings", url: `/orgs/${orgId}/settings`, icon: Settings },
  ];
}

/**
 * Collapsible sidebar rendered in the app layout.
 *
 * Behaviour:
 * - Outside an org: shows the global workspace nav with collapsible sections
 *   (Organizations with Create + Invitations, and Help with sub-links).
 * - Inside an org: switches to org-scoped nav and shows footer items (e.g. Settings).
 * - Active page is highlighted via `isActive`, derived from the current pathname.
 */
export function AppSidebar() {
  // orgId is present on any /orgs/[orgId]/... route, undefined otherwise
  const { orgId } = useParams<{ orgId?: string }>();
  const pathname = usePathname();
  const [parentOwnerStatus, setParentOwnerStatus] = useState<{
    orgId: string | null;
    isParentOwner: boolean;
  }>({ orgId: null, isParentOwner: false });

  useEffect(() => {
    if (!orgId) return;
    const controller = new AbortController();
    fetch(`/api/orgs/${orgId}/is-parent-owner`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load parent-owner status");
        return r.json();
      })
      .then((d) => setParentOwnerStatus({ orgId, isParentOwner: d.isParentOwner ?? false }))
      .catch(() => {});
    return () => controller.abort();
  }, [orgId]);

  // Only true when the stored status is for the current org (prevents stale flash on org switch)
  const isParentOwner = parentOwnerStatus.orgId === orgId && parentOwnerStatus.isParentOwner;

  const navItems = orgId ? getNavItems(orgId, pathname) : [];
  const footerItems = orgId ? getFooterItems(orgId, pathname, isParentOwner) : [];

  /**
   * Returns true when a nav item should be highlighted.
   * - Org overview uses exact match so it doesn't light up on every org page.
   * - All other items use prefix matching so nested pages (e.g. /tasks/new)
   *   still highlight their parent section.
   */
  const isActiveItem = (url: string) => {
    if (orgId && url === `/orgs/${orgId}`) return pathname === url;
    return pathname === url || pathname.startsWith(`${url}/`);
  };

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
              {orgId ? (
                // ── Org / Settings nav (mutually exclusive, same shape) ──
                navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActiveItem(item.url)}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                // ── Global workspace nav ─────────────────────────────────
                <>
                  {/* Workspace */}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/"}>
                      <Link href="/">
                        <LayoutDashboard />
                        <span>Workspace</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* Organizations — collapsible, open by default */}
                  <NavCollapsible
                    icon={Building2}
                    label="Organizations"
                    defaultOpen
                  >
                    <SidebarMenuSubItem>
                      {/* List — stub until feature is implemented */}
                      <SidebarMenuSubButton title="Coming soon">
                        <ListCheckIcon />
                        <span>List</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={isActiveItem("/orgs/new")}
                      >
                        <Link href="/orgs/new">
                          <PlusCircle />
                          <span>Create</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      {/* Invitations — stub until feature is implemented */}
                      <SidebarMenuSubButton title="Coming soon">
                        <Mail />
                        <span>Invitations</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </NavCollapsible>

                  {/* Help — collapsible, closed by default */}
                  <NavCollapsible icon={HelpCircle} label="Help">
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton title="Coming soon">
                        <BookOpen />
                        <span>Instructions</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton title="Coming soon">
                        <Info />
                        <span>About</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton title="Coming soon">
                        <Phone />
                        <span>Contact</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </NavCollapsible>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Settings footer — only inside an org and not in settings */}
      {footerItems.length > 0 && (
        <>
          <SidebarSeparator className="border-dashed" />
          <SidebarFooter>
            <SidebarMenu>
              {footerItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActiveItem(item.url)}>
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
