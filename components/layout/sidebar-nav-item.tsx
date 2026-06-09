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
import type { ComponentType, MouseEvent } from "react";

export type SidebarNavItemProps = {
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  isActive: boolean;
  /** "app" = fixed w-12 icon wrapper for the collapsible global sidebar.
   *  "page" = standard px-3 gap layout for full-width page sidebars. */
  variant?: "app" | "page";
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
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
  const appActive =
    "bg-sidebar-primary text-sidebar-primary-foreground font-bold after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:w-5 after:h-0.5 after:rounded-full after:bg-primary";
  const pageActive =
    "bg-sidebar-primary/10 text-sidebar-primary-foreground font-semibold ring-1 ring-sidebar-border/60 shadow-sm before:absolute before:left-2.5 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary after:absolute after:right-2.5 after:top-1/2 after:h-2 after:w-2 after:-translate-y-1/2 after:rounded-full after:bg-primary/30";

  if (variant === "app") {
    const base =
      "relative flex items-center h-12 w-full overflow-hidden rounded-none transition-all duration-150";
    const inner = (
      <span className="mx-auto flex w-10 flex-col items-center justify-center gap-0.5 rounded-xl border border-transparent bg-sidebar-background/70 py-1 shadow-sm ring-1 ring-transparent transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-sidebar-border/70 group-hover:bg-sidebar-accent/40 group-hover:ring-sidebar-border/40 group-hover:shadow-md">
        <Icon className="h-4 w-4 transition-transform duration-150 group-hover:scale-105" />
        <span className="w-full px-0.5 text-center text-[7px] leading-none uppercase tracking-[0.08em] text-sidebar-foreground/75">
          {title}
        </span>
      </span>
    );
    if (disabled)
      return (
        <div
          className={cn(
            base,
            "opacity-40 pointer-events-none text-sidebar-foreground",
          )}
          role="link"
          aria-disabled="true"
        >
          {inner}
        </div>
      );
    return (
      <Link
        href={url}
        onClick={onClick}
        className={cn(
          base,
          "group",
          isActive
            ? cn(appActive, "bg-sidebar-primary/12")
            : cn(
                "text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                "before:absolute before:left-0 before:top-1/2 before:h-6 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-transparent before:transition-colors",
              ),
        )}
        aria-current={isActive ? "page" : undefined}
      >
        {inner}
      </Link>
    );
  }

  // page variant
  const base =
    "group relative mx-2 my-0.5 flex h-12 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-all duration-150 before:absolute before:left-2.5 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-transparent before:transition-colors";
  const inner = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-background/70 text-sidebar-foreground ring-1 ring-sidebar-border/50 shadow-sm transition-all duration-150 group-hover:-translate-y-0.5 group-hover:bg-sidebar-accent/70 group-hover:shadow-md group-hover:ring-sidebar-border/70">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="truncate tracking-[0.01em]">{title}</span>
    </>
  );
  if (disabled) {
    return (
      <div
        className={cn(
          base,
          "opacity-40 pointer-events-none text-sidebar-foreground",
          "before:bg-transparent",
        )}
        role="link"
        aria-disabled="true"
      >
        {inner}
      </div>
    );
  }
  return (
    <Link
      href={url}
      onClick={onClick}
      className={cn(
        base,
        "group",
        isActive
          ? cn(pageActive, "bg-sidebar-primary/12")
          : cn(
              "text-sidebar-foreground/85 hover:-translate-y-0.5 hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground hover:shadow-sm",
              "before:bg-transparent",
            ),
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {inner}
    </Link>
  );
}
