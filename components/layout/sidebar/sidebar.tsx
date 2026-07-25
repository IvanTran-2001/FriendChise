"use client";

/**
 * AppSidebar — global navigation sidebar.
 *
 * Desktop: fixed `w-12` strip. Items are `SidebarNavItem variant="app"`
 * icon-only rows so the global sidebar stays compact everywhere.
 *
 * Mobile: hidden by default; renders as a fixed overlay (`inset-y-0 left-0
 * z-50`) when the hamburger button in NavBar is tapped. Controlled via
 * `MobileSidebarCtx`. Clicking outside or navigating closes it.
 *
 * Exports `MobileSidebarTrigger` (hamburger button for NavBar) and re-exports
 * `GlobalSidebarProvider` / `useMobileSidebar` from mobile-sidebar-context.
 */
import { useState, useEffect, useContext } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/core/utils";
import {
  LayoutDashboard,
  Building2,
  ListTodo,
  Users,
  Calendar,
  Settings,
  HelpCircle,
  Network,
  Menu,
  Wrench,
  ShieldCheck,
  Bell,
  Tag,
  ChevronLeft,
  Megaphone,
  User,
  Palette,
} from "lucide-react";
import {
  MobileSidebarCtx,
  useMobileSidebar,
  GlobalSidebarProvider,
} from "@/components/layout/contexts/mobile-sidebar-context";
import {
  useOrgSettingsPermissions,
  type OrgSettingsPermissions,
} from "@/components/layout/contexts/org-settings-permissions-context";
import { Logo } from "@/components/layout/global/logo";
import { SidebarNavItem } from "./sidebar-nav-item";

export { GlobalSidebarProvider, useMobileSidebar };

/** Hamburger trigger rendered in the navbar on mobile. */
export function MobileSidebarTrigger() {
  const { open, setOpen } = useContext(MobileSidebarCtx);
  return (
    <button
      onClick={() => setOpen(!open)}
      data-tour-target="sidebar-toggle"
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      className="md:hidden flex items-center justify-center h-9 w-9 rounded-full border border-border/60 bg-background/85 text-foreground/70 transition-colors duration-150 hover:border-border hover:bg-muted/60 hover:text-foreground"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

// ─── Nav data ─────────────────────────────────────────────────────────────────

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  tourTarget?: string;
};

function getOrgItems(orgId: string): NavItem[] {
  return [
    { title: "Updates", url: `/orgs/${orgId}/announcements`, icon: Megaphone },
    { title: "Home", url: `/orgs/${orgId}`, icon: Building2 },
    {
      title: "Sched",
      url: `/orgs/${orgId}/timetable`,
      icon: Calendar,
      tourTarget: "sidebar-timetable",
    },
    {
      title: "Tasks",
      url: `/orgs/${orgId}/tasks`,
      icon: ListTodo,
      tourTarget: "sidebar-tasks",
    },
    { title: "Tools", url: `/orgs/${orgId}/tools`, icon: Wrench },
    { title: "Members", url: `/orgs/${orgId}/memberships`, icon: Users },
  ];
}

function getNavItems(orgId: string, pathname: string): NavItem[] {
  if (pathname.startsWith(`/orgs/${orgId}`)) return getOrgItems(orgId);
  return [];
}

function getFooterItems(
  orgId: string,
  pathname: string,
  isParentOwner: boolean,
  parentOrgId: string | null,
): NavItem[] {
  const franchiseeOrgId = isParentOwner ? orgId : parentOrgId;
  return [
    ...(franchiseeOrgId
      ? [
          {
            title: "Franch",
            url: `/orgs/${franchiseeOrgId}/franchisee`,
            icon: Network,
          },
        ]
      : []),
    { title: "Settings", url: `/orgs/${orgId}/settings`, icon: Settings },
  ];
}

function getSettingsItems(orgId: string): NavItem[] {
  return [
    {
      title: "Org",
      url: `/orgs/${orgId}/settings/organization`,
      icon: Building2,
    },
    { title: "Roles", url: `/orgs/${orgId}/settings/roles`, icon: ShieldCheck },
    { title: "Tags", url: `/orgs/${orgId}/settings/tags`, icon: Tag },
    { title: "User", url: `/orgs/${orgId}/settings`, icon: User },
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
}

// ─── Nav item components ──────────────────────────────────────────────────────

// (Shared SidebarNavItem imported from ./sidebar-nav-item)

// ─── AppSidebar ───────────────────────────────────────────────────────────────

/**
 * Global sidebar rendered in the app layout.
 *
 * Desktop: a fixed sidebar sits in the flex layout. When the page has its own
 * sidebar, the app nav stays compact (`w-12`) and uses the mobile-style icon
 * strip. Otherwise it renders as the wider full nav (`w-52`).
 *
 * Mobile: hidden by default. A full-screen overlay is toggled via
 * GlobalSidebarProvider / MobileSidebarTrigger.
 */
export function AppSidebar() {
  const { orgId } = useParams<{ orgId?: string }>();
  const pathname = usePathname();
  const { open, setOpen } = useContext(MobileSidebarCtx);
  const { orgId: permissionsOrgId, permissions } = useOrgSettingsPermissions();

  // Close the mobile overlay on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const [parentOwnerStatus, setParentOwnerStatus] = useState<{
    orgId: string | null;
    isParentOwner: boolean;
    parentOrgId: string | null;
  }>({ orgId: null, isParentOwner: false, parentOrgId: null });

  useEffect(() => {
    if (!orgId) return;
    const controller = new AbortController();
    fetch(`/api/orgs/${orgId}/is-parent-owner`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load parent-owner status");
        return r.json();
      })
      .then((d) =>
        setParentOwnerStatus({
          orgId,
          isParentOwner: d.isParentOwner ?? false,
          parentOrgId: d.parentOrgId ?? null,
        }),
      )
      .catch(() => {});
    return () => controller.abort();
  }, [orgId]);

  const settingsPermissions: OrgSettingsPermissions | null =
    permissionsOrgId === orgId ? permissions : null;

  const isParentOwner =
    parentOwnerStatus.orgId === orgId && parentOwnerStatus.isParentOwner;
  const parentOrgId =
    parentOwnerStatus.orgId === orgId ? parentOwnerStatus.parentOrgId : null;

  const navItems = orgId ? getNavItems(orgId, pathname) : [];
  const footerItems = orgId
    ? getFooterItems(orgId, pathname, isParentOwner, parentOrgId)
    : [];

  const isSettingsRoute =
    !!orgId && pathname.startsWith(`/orgs/${orgId}/settings`);
  const isAccountSettingsRoute = pathname.startsWith("/settings");
  const settingsItems = orgId ? getSettingsItems(orgId) : [];

  const isActiveItem = (url: string) => {
    if (orgId && url === `/orgs/${orgId}`) return pathname === url;
    if (orgId && url === `/orgs/${orgId}/settings`) return pathname === url;
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  const navContent = () => {
    // ── Account Settings mode ────────────────────────────────────────────────
    if (isAccountSettingsRoute) {
      return (
        <>
          {/* Back button */}
          <Link
            href="/"
            className="flex items-center h-12 shrink-0 gap-3 px-3 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors border-b border-sidebar-border"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap overflow-hidden">Back</span>
          </Link>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="flex flex-col">
              <SidebarNavItem
                variant="app"
                title="Account"
                url="/settings/account"
                icon={User}
                isActive={pathname === "/settings/account"}
              />
              <SidebarNavItem
                variant="app"
                title="Orgs"
                url="/settings/organizations"
                icon={Building2}
                isActive={false}
                disabled={true}
              />
              <SidebarNavItem
                variant="app"
                title="Theme"
                url="/settings/theme"
                icon={Palette}
                isActive={false}
                disabled={true}
              />
            </div>
          </div>
        </>
      );
    }

    // ── Settings mode ──────────────────────────────────────────────────────
    if (isSettingsRoute && orgId) {
      return (
        <>
          {/* Back button */}
          <Link
            href={`/orgs/${orgId}`}
            className="flex items-center h-12 shrink-0 gap-3 px-3 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors border-b border-sidebar-border"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap overflow-hidden">Back</span>
          </Link>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="flex flex-col">
              {settingsPermissions && settingsItems
                .filter((item) => {
                  if (item.url.endsWith("/settings/organization")) {
                    return settingsPermissions.canManageOrgSettings;
                  }
                  if (item.url.endsWith("/settings/roles")) {
                    return settingsPermissions.canManageRoles;
                  }
                  if (
                    item.url.endsWith("/settings/tags") ||
                    item.url.endsWith("/settings/timetable") ||
                    item.url.endsWith("/settings/notification")
                  ) {
                    return settingsPermissions.canManageSettings;
                  }
                  if (item.url.endsWith("/settings")) {
                    return true;
                  }
                  return true;
                })
                .map((item) => (
                  <SidebarNavItem
                    key={item.title}
                    variant="app"
                    {...item}
                    isActive={isActiveItem(item.url)}
                  />
                ))}
            </div>
          </div>
        </>
      );
    }

    // ── Normal mode ────────────────────────────────────────────────────────
    return (
      <>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex flex-col">
            {orgId ? (
              navItems.map((item) => (
                <SidebarNavItem
                  key={item.title}
                  variant="app"
                  {...item}
                  isActive={isActiveItem(item.url)}
                />
              ))
            ) : (
              <>
                <SidebarNavItem
                  variant="app"
                  title="Hub"
                  url="/"
                  icon={LayoutDashboard}
                  isActive={pathname === "/"}
                />

                <SidebarNavItem
                  variant="app"
                  title="Org"
                  url="/orgs/new"
                  icon={Building2}
                  tourTarget="sidebar-org"
                  isActive={isActiveItem("/orgs")}
                />

                <SidebarNavItem
                  variant="app"
                  title="Notification"
                  url="/notifications"
                  icon={Bell}
                  isActive={isActiveItem("/notifications")}
                />

                <SidebarNavItem
                  variant="app"
                  title="Help"
                  url="/help"
                  icon={HelpCircle}
                  disabled
                  isActive={false}
                />

                <SidebarNavItem
                  variant="app"
                  title="Docs"
                  url="/doc"
                  icon={HelpCircle}
                  isActive={isActiveItem("/doc")}
                />
              </>
            )}
          </div>
        </div>
        {footerItems.length > 0 && (
          <div className="border-t border-sidebar-border">
            <div className="flex flex-col">
              {footerItems.map((item) => (
                <SidebarNavItem
                  key={item.title}
                  variant="app"
                  {...item}
                  isActive={isActiveItem(item.url)}
                />
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      {/* ── Desktop: fixed width, compact when a page sidebar is present ── */}
      <div className={cn("hidden md:block relative shrink-0 w-12") }>
        <div
          data-tour-target="app-sidebar"
          className={cn(
            "absolute inset-y-0 left-0 z-30 flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden w-12",
          )}
        >
          {navContent()}
        </div>
      </div>

      {/* ── Mobile: overlay, shown when hamburger is open ── */}
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "md:hidden fixed inset-y-0 left-0 z-50 bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden w-12",
            )}
          >
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex h-12 shrink-0 items-center justify-center px-0 text-foreground"
            >
              <Logo className="scale-[0.84] text-foreground" />
            </Link>
            {navContent()}
          </div>
        </>
      )}
    </>
  );
}
