"use client";

/**
 * SidebarNavItem — shared navigation link used in both the app sidebar and
 * page-level sidebars.
 *
 * Variants:
 *  - `app` (default) — full-bleed `h-12` item with a fixed `w-12` icon well
 *    and a slide-in label. Used inside the hover-expand global `AppSidebar`.
 *  - `page` — `h-12 px-4` item with an inline icon+label row. Used inside
 *    page sidebars (settings, org management).
 *
 * Active state is determined by prefix-matching `href` against the current
 * pathname, except for exact-match items (pass `exact` prop).
 */
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

type SidebarNavItemProps = {
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  isActive: boolean;
  /** "app" = fixed w-12 icon wrapper for the collapsible global sidebar.
   *  "page" = standard px-3 gap layout for full-width page sidebars. */
  variant?: "app" | "page";
  onClick?: () => void;
};

export function SidebarNavItem({
  title,
  url,
  icon: Icon,
  disabled,
  isActive,
  variant = "page",
  onClick,
}: SidebarNavItemProps) {
  const appActive = "bg-sidebar-primary text-sidebar-primary-foreground font-bold after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:w-5 after:h-0.5 after:rounded-full after:bg-primary";
  const pageActive = "bg-sidebar-primary text-sidebar-primary-foreground font-medium before:absolute before:top-2 before:left-2 before:w-2.5 before:h-2.5 before:border-t-2 before:border-l-2 before:border-primary after:absolute after:bottom-2 after:right-2 after:w-2.5 after:h-2.5 after:border-b-2 after:border-r-2 after:border-primary";
  const hover = "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

  if (variant === "app") {
    const base = "relative flex items-center h-12 w-full overflow-hidden rounded-none transition-colors";
    const inner = (
      <>
        <span className="w-12 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5" />
        </span>
        <span className="whitespace-nowrap text-sm pr-3">
          {title}
        </span>
      </>
    );
    if (disabled) return <div className={cn(base, "opacity-40 pointer-events-none text-sidebar-foreground")} role="link" aria-disabled="true">{inner}</div>;
    return (
      <Link href={url} onClick={onClick} className={cn(base, isActive ? appActive : cn("text-sidebar-foreground", hover))} aria-current={isActive ? "page" : undefined}>
        {inner}
      </Link>
    );
  }

  // page variant
  const base = "relative flex items-center gap-2.5 h-12 px-4 text-sm transition-colors";
  const inner = (
    <>
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{title}</span>
    </>
  );
  if (disabled) {
    return (
      <div className={cn(base, "opacity-40 pointer-events-none text-sidebar-foreground")} role="link" aria-disabled="true">
        {inner}
      </div>
    );
  }
  return (
    <Link
      href={url}
      onClick={onClick}
      className={cn(base, isActive ? pageActive : cn("text-sidebar-foreground", hover))}
      aria-current={isActive ? "page" : undefined}
    >
      {inner}
    </Link>
  );
}
