"use client";

import { useState, useEffect, createContext, useContext } from "react";
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
  HeartHandshake,
  X,
  Menu,
} from "lucide-react";

// ─── Mobile sidebar context ───────────────────────────────────────────────────

const MobileSidebarCtx = createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
}>({ open: false, setOpen: () => {} });

export function GlobalSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <MobileSidebarCtx.Provider value={{ open, setOpen }}>
      {children}
    </MobileSidebarCtx.Provider>
  );
}

/** Hamburger trigger rendered in the navbar on mobile. */
export function MobileSidebarTrigger() {
  const { setOpen } = useContext(MobileSidebarCtx);
  return (
    <button
      onClick={() => setOpen(true)}
      aria-label="Open menu"
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
    // TODO: remove `disabled: true` when overview page is implemented
    { title: "Overview", url: `/orgs/${orgId}`, icon: Building2, disabled: true },
    { title: "Timetable", url: `/orgs/${orgId}/timetable`, icon: Calendar },
    { title: "Tasks", url: `/orgs/${orgId}/tasks`, icon: ListTodo },
    { title: "Members", url: `/orgs/${orgId}/memberships`, icon: Users },
    // TODO: remove `disabled: true` when progress page is implemented
    { title: "Progress", url: `/orgs/${orgId}/progress`, icon: BarChart2, disabled: true },
  ];
}

function getSettingsItems(orgId: string): NavItem[] {
  return [
    { title: "Back to Org", url: `/orgs/${orgId}/timetable`, icon: ChevronLeft },
    { title: "Organization", url: `/orgs/${orgId}/settings/organization`, icon: Building2 },
    { title: "Roles", url: `/orgs/${orgId}/settings/roles`, icon: ShieldCheck },
    // TODO: remove `disabled: true` when settings timetable page is implemented
    { title: "Timetable", url: `/orgs/${orgId}/settings/timetable`, icon: Calendar, disabled: true },
    // TODO: remove `disabled: true` when settings notification page is implemented
    { title: "Notification", url: `/orgs/${orgId}/settings/notification`, icon: Bell, disabled: true },
  ];
}

function getNavItems(orgId: string, pathname: string): NavItem[] {
  if (pathname.startsWith(`/orgs/${orgId}/settings`)) return getSettingsItems(orgId);
  if (pathname.startsWith(`/orgs/${orgId}`)) return getOrgItems(orgId);
  return [];
}

function getFooterItems(
  orgId: string,
  pathname: string,
  isParentOwner: boolean,
  parentOrgId: string | null,
): NavItem[] {
  if (pathname.startsWith(`/orgs/${orgId}/settings`)) return [];
  const franchiseeOrgId = isParentOwner ? orgId : parentOrgId;
  return [
    ...(franchiseeOrgId
      ? [{ title: "Franchisee", url: `/orgs/${franchiseeOrgId}/franchisee`, icon: Network }]
      : []),
    { title: "Settings", url: `/orgs/${orgId}/settings`, icon: Settings },
  ];
}

// ─── Nav item components ──────────────────────────────────────────────────────

/**
 * A single nav row. The icon wrapper is always `w-12` wide so the icon stays
 * centred in the collapsed (icon-only) strip. The text flows after it and is
 * clipped by the parent's `overflow-hidden` when collapsed.
 */
function NavRow({
  title,
  url,
  icon: Icon,
  disabled,
  isActive,
  onClick,
}: NavItem & { isActive: boolean; onClick?: () => void }) {
  const base =
    "flex items-center h-9 w-full overflow-hidden rounded-md transition-colors";
  const active = "bg-sidebar-accent text-sidebar-accent-foreground font-medium";
  const hover = "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground";
  const dis = "opacity-40 pointer-events-none";

  const inner = (
    <>
      <span className="w-12 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-sidebar-foreground" />
      </span>
      <span className="whitespace-nowrap text-sm pr-3 text-sidebar-foreground">
        {title}
      </span>
    </>
  );

  if (disabled) return <div className={cn(base, dis)}>{inner}</div>;
  return (
    <Link href={url} onClick={onClick} className={cn(base, isActive ? active : hover)}>
      {inner}
    </Link>
  );
}

/**
 * A collapsible nav section. Only visible/usable when the sidebar is expanded.
 */
function NavCollapsibleRow({
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
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center h-9 w-full overflow-hidden rounded-md hover:bg-sidebar-accent/70 transition-colors"
      >
        <span className="w-12 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-sidebar-foreground" />
        </span>
        <span className="whitespace-nowrap text-sm text-sidebar-foreground">
          {label}
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200 text-sidebar-foreground ml-auto mr-3",
            open && "rotate-90",
          )}
        />
      </button>
      {open && <div className="pl-10 flex flex-col gap-0.5 pb-1">{children}</div>}
    </div>
  );
}

function SubRow({
  href,
  icon: Icon,
  label,
  isActive,
  onClick,
  disabled,
}: {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const base =
    "flex items-center gap-2 h-8 px-2 rounded-md text-xs transition-colors text-sidebar-foreground whitespace-nowrap w-full";
  const active = "bg-sidebar-accent text-sidebar-accent-foreground font-medium";
  const hover = "hover:bg-sidebar-accent/70";
  const dis = "opacity-40 pointer-events-none";
  const inner = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </>
  );
  if (disabled) return <div className={cn(base, dis)}>{inner}</div>;
  if (!href) return <div className={cn(base, hover)}>{inner}</div>;
  return (
    <Link href={href} onClick={onClick} className={cn(base, isActive ? active : hover)}>
      {inner}
    </Link>
  );
}

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
  const { open: mobileOpen, setOpen: setMobileOpen } = useContext(MobileSidebarCtx);

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

  const isActiveItem = (url: string) => {
    if (orgId && url === `/orgs/${orgId}`) return pathname === url;
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  const navContent = (mobile: boolean) => {
    const close = mobile ? () => setMobileOpen(false) : undefined;
    return (
      <>
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
          <div className="flex flex-col gap-0.5">
            {orgId ? (
              navItems.map((item) => (
                <NavRow
                  key={item.title}
                  {...item}
                  isActive={isActiveItem(item.url)}
                  onClick={close}
                />
              ))
            ) : (
              <>
                <NavRow
                  title="Workspace"
                  url="/"
                  icon={LayoutDashboard}
                  isActive={pathname === "/"}
                  onClick={close}
                />
                <NavCollapsibleRow icon={Building2} label="Organizations" defaultOpen>
                  <SubRow icon={ListCheckIcon} label="List" disabled />
                  <SubRow
                    icon={PlusCircle}
                    label="Create"
                    href="/orgs/new"
                    isActive={isActiveItem("/orgs/new")}
                    onClick={close}
                  />
                  <SubRow icon={Mail} label="Invitations" disabled />
                </NavCollapsibleRow>
                <NavCollapsibleRow icon={HelpCircle} label="Help">
                  <SubRow icon={BookOpen} label="Instructions" disabled />
                  <SubRow icon={Info} label="About" disabled />
                  <SubRow icon={Phone} label="Contact" disabled />
                </NavCollapsibleRow>
              </>
            )}
          </div>
        </div>
        {footerItems.length > 0 && (
          <div className="border-t border-sidebar-border py-1">
            <div className="flex flex-col gap-0.5">
              {footerItems.map((item) => (
                <NavRow
                  key={item.title}
                  {...item}
                  isActive={isActiveItem(item.url)}
                  onClick={close}
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
      {/* ── Desktop: spacer + absolute overlay panel ── */}
      <div className="hidden md:block relative w-12 shrink-0">
        <div className="absolute inset-y-0 left-0 z-30 flex flex-col w-12 hover:w-52 transition-[width] duration-200 bg-sidebar border-r border-sidebar-border overflow-hidden">
          {navContent(false)}
        </div>
      </div>

      {/* ── Mobile: full-screen overlay ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-sidebar flex flex-col overflow-hidden">
            <div className="flex items-center justify-between h-14 px-4 border-b border-sidebar-border shrink-0">
              <span className="flex items-center gap-2 text-sm font-semibold text-sidebar-foreground select-none">
                <span className="flex items-center justify-center rounded-full border-2 border-current p-1.5">
                  <HeartHandshake className="h-4 w-4" strokeWidth={1.75} />
                </span>
                FriendChise
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {navContent(true)}
          </div>
          {/* Backdrop */}
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
