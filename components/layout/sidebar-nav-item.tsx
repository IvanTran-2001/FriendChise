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
import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

export type SidebarNavItemProps = {
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  isActive: boolean;
  className?: string;
  /** "app" = fixed w-12 icon wrapper for the collapsible global sidebar.
   *  "page" = standard px-3 gap layout for full-width page sidebars. */
  variant?: "app" | "page";
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

function useRememberedNavHref({
  url,
  isActive,
  pathname,
  disabled,
}: {
  url: string;
  isActive: boolean;
  pathname: string;
  disabled?: boolean;
}) {
  const isToolsMenu = url.endsWith("/tools");
  const storageKey = isToolsMenu ? `friendchise-nav-url-${url}` : null;

  const subscribe = (onStoreChange: () => void) => {
    if (!storageKey || typeof window === "undefined") return () => {};

    const eventName = `persisted-state-change:${storageKey}`;
    const onCustomChange = () => onStoreChange();
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === storageKey) onStoreChange();
    };

    window.addEventListener(eventName, onCustomChange as EventListener);
    window.addEventListener("storage", onStorageChange as EventListener);

    return () => {
      window.removeEventListener(eventName, onCustomChange as EventListener);
      window.removeEventListener("storage", onStorageChange as EventListener);
    };
  };

  const getSnapshot = () => {
    if (disabled || !storageKey) return url;
    if (isActive) return url;
    if (typeof window === "undefined") return url;

    try {
      return localStorage.getItem(storageKey) || url;
    } catch {
      return url;
    }
  };

  const getServerSnapshot = () => url;

  const href = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!storageKey || disabled || typeof window === "undefined" || !isActive) return;

    try {
      localStorage.setItem(storageKey, pathname);
      window.dispatchEvent(new CustomEvent(`persisted-state-change:${storageKey}`));
    } catch {
      // Ignore storage errors.
    }
  }, [disabled, isActive, pathname, storageKey]);

  return href;
}

export function SidebarNavItem({
  title,
  url,
  icon: Icon,
  disabled,
  isActive,
  className,
  variant = "page",
  onClick,
}: SidebarNavItemProps) {
  // Active — clean left accent bar + very subtle fill (Jira-style)
  const pathname = usePathname();
  const dynamicHref = useRememberedNavHref({ url, isActive, pathname, disabled });

  const appActive =
    "bg-sidebar-primary/10 text-primary font-semibold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-primary";
  const pageActive =
    "bg-sidebar-primary/10 text-primary font-semibold before:absolute before:left-2.5 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-primary";


  if (variant === "app") {
    const base =
      "relative flex items-center h-12 w-full overflow-hidden rounded-none transition-colors duration-150";
    const inner = (
      <span className="mx-auto flex w-10 flex-col items-center justify-center gap-0.5 rounded-md py-1.5 transition-colors duration-150">
        <Icon className="h-4.5 w-4.5" />
        <span className="w-full px-0.5 text-center text-[7px] leading-none uppercase tracking-[0.08em] opacity-60">
          {title}
        </span>
      </span>
    );
    if (disabled)
      return (
        <div
          className={cn(
            base,
            className,
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
        href={dynamicHref}
        onClick={onClick}
        className={cn(
          base,
          className,
          "group",
          isActive
            ? appActive
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
        aria-current={isActive ? "page" : undefined}
      >
        {inner}
      </Link>
    );
  }

  // page variant
  const base =
    "group relative mx-2 my-0.5 flex h-9 items-center gap-2.5 rounded-md px-3 text-[13px] font-medium transition-colors duration-150 before:absolute before:left-2.5 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-transparent before:transition-colors";
  const inner = (
    <>
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
          isActive
            ? "text-current"
            : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{title}</span>
    </>
  );
  if (disabled) {
    return (
      <div
        className={cn(
          base,
          className,
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
      href={dynamicHref}
      onClick={onClick}
      className={cn(
        base,
        className,
        "group",
        isActive
          ? pageActive
          : cn(
              "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              "before:bg-transparent",
            ),
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {inner}
    </Link>
  );
}
