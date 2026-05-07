"use client";

/**
 * AppSidebar — global navigation sidebar.
 *
 * Desktop: fixed `w-12` strip that hover-expands to `w-52`. Items are
 * `SidebarNavItem variant="app"` — full-bleed `h-12` rows with a `w-12` icon
 * well and a label that slides in on expand.
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
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  ListTodo,
  Users,
  Calendar,
  BarChart2,
  Settings,
  HelpCircle,
  Network,
  Menu,
  HeartHandshake,
  Wrench,
  ShieldCheck,
  Bell,
  Tag,
  ChevronLeft,
} from "lucide-react";
import {
  MobileSidebarCtx,
  useMobileSidebar,
  GlobalSidebarProvider,
} from "./mobile-sidebar-context";
import { useHasPageSidebar } from "./page-sidebar-context";
import { Logo } from "./logo";
import { SidebarNavItem } from "./sidebar-nav-item";

export { GlobalSidebarProvider, useMobileSidebar };

/** Hamburger trigger rendered in the navbar on mobile. */
export function MobileSidebarTrigger() {
  const { open, setOpen } = useContext(MobileSidebarCtx);
  return (
    <button
      onClick={() => setOpen(!open)}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      className="md:hidden rounded-md p-1.5 text-foreground/70 hover:text-foreground hover:bg-accent transition-colors"
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
};

function getOrgItems(orgId: string): NavItem[] {
  return [
    { title: "Overview", url: `/orgs/${orgId}`, icon: Building2 },
    { title: "Timetable", url: `/orgs/${orgId}/timetable`, icon: Calendar },
    { title: "Tasks", url: `/orgs/${orgId}/tasks`, icon: ListTodo },
    {
      title: "Tools",
      url: `/orgs/${orgId}/tools`,
      icon: Wrench,
      disabled: true,
    },
    { title: "Members", url: `/orgs/${orgId}/memberships`, icon: Users },
    // TODO: remove `disabled: true` when progress page is implemented
    {
      title: "Progress",
      url: `/orgs/${orgId}/progress`,
      icon: BarChart2,
      disabled: true,
    },
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
            title: "Franchisee",
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
    { title: "Organization", url: `/orgs/${orgId}/settings/organization`, icon: Building2 },
    { title: "Roles", url: `/orgs/${orgId}/settings/roles`, icon: ShieldCheck },
    { title: "Tags", url: `/orgs/${orgId}/settings/tags`, icon: Tag },
    { title: "Timetable", url: `/orgs/${orgId}/settings/timetable`, icon: Calendar, disabled: true },
    { title: "Notification", url: `/orgs/${orgId}/settings/notification`, icon: Bell, disabled: true },
  ];
}

// ─── Nav item components ──────────────────────────────────────────────────────

// (Shared SidebarNavItem imported from ./sidebar-nav-item)

// ─── AppSidebar ───────────────────────────────────────────────────────────────

/**
 * Global sidebar rendered in the app layout.
 *
 * Desktop: a w-12 spacer holds space in the flex layout. An `absolute`-
 * positioned panel sits over it and expands to w-52 on hover, overlaying
 * the page content. Icons are always centred in the 48px strip.
 *
 * Mobile: hidden by default. A full-screen overlay is toggled via
 * GlobalSidebarProvider / MobileSidebarTrigger.
 */
export function AppSidebar() {
  const { orgId } = useParams<{ orgId?: string }>();
  const pathname = usePathname();
  const { open, setOpen } = useContext(MobileSidebarCtx);
  const hasSidebar = useHasPageSidebar();

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

  const isParentOwner =
    parentOwnerStatus.orgId === orgId && parentOwnerStatus.isParentOwner;
  const parentOrgId =
    parentOwnerStatus.orgId === orgId ? parentOwnerStatus.parentOrgId : null;

  const navItems = orgId ? getNavItems(orgId, pathname) : [];
  const footerItems = orgId
    ? getFooterItems(orgId, pathname, isParentOwner, parentOrgId)
    : [];

  const isSettingsRoute = !!orgId && pathname.startsWith(`/orgs/${orgId}/settings`);
  const settingsItems = orgId ? getSettingsItems(orgId) : [];

  const isActiveItem = (url: string) => {
    if (orgId && url === `/orgs/${orgId}`) return pathname === url;
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  const navContent = () => {
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
              {settingsItems.map((item) => (
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
                  title="Organizations"
                  url="/orgs/new"
                  icon={Building2}
                  isActive={isActiveItem("/orgs")}
                />
                <SidebarNavItem
                  variant="app"
                  title="Help"
                  url="/help"
                  icon={HelpCircle}
                  isActive={false}
                  disabled
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
      {/* ── Desktop: spacer + absolute hover-expand panel ── */}
      <div className="hidden md:block relative w-12 shrink-0">
        <div className="absolute inset-y-0 left-0 z-30 flex flex-col w-12 hover:w-52 transition-[width] duration-200 bg-sidebar border-r border-sidebar-border overflow-hidden">
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
              "md:hidden fixed inset-y-0 left-0 z-50 bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden",
              !hasSidebar ? "w-52" : "w-12",
            )}
          >
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center h-12 shrink-0 text-foreground px-2"
            >
              {!hasSidebar ? (
                <Logo className="text-foreground" />
              ) : (
                <span className="flex items-center justify-center w-full rounded-full border-2 border-current p-1.5">
                  <HeartHandshake className="h-4 w-4" strokeWidth={1.75} />
                </span>
              )}
            </Link>
            {navContent()}
          </div>
        </>
      )}
    </>
  );
}
