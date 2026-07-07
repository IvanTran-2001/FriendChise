"use client";

import type { ComponentType } from "react";

import { useBackNavigation } from "@/components/layout/use-back-navigation";
import { cn } from "@/lib/utils";

interface BackSidebarNavItemProps {
  title: string;
  fallbackHref: string;
  icon: ComponentType<{ className?: string }>;
}

export function BackSidebarNavItem({
  title,
  fallbackHref,
  icon: Icon,
}: BackSidebarNavItemProps) {
  const handleClick = useBackNavigation(fallbackHref);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group relative mx-2 my-0.5 flex h-9 items-center gap-2.5 rounded-md px-3 text-[13px] font-medium transition-colors duration-150 before:absolute before:left-2.5 before:top-1/2 before:h-5 before:w-0.75 before:-translate-y-1/2 before:rounded-full before:bg-transparent before:transition-colors",
        "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-150 text-sidebar-foreground/60 group-hover:text-sidebar-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{title}</span>
    </button>
  );
}