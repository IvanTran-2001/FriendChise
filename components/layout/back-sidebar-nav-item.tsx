"use client";

import type { ComponentType } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { useBackNavigation } from "@/components/layout/use-back-navigation";

interface BackSidebarNavItemProps {
  title: string;
  fallbackHref: string;
  icon: ComponentType<{ className?: string }>;
  showSecondaryButton?: boolean;
  secondaryButton?: {
    title: string;
    href: string;
    icon: ComponentType<{ className?: string }>;
  };
}

export function BackSidebarNavItem({
  title,
  fallbackHref,
  icon: Icon,
  showSecondaryButton,
  secondaryButton,
}: BackSidebarNavItemProps) {
  const handleClick = useBackNavigation(fallbackHref);
  const shouldShowSecondaryButton = showSecondaryButton ?? Boolean(secondaryButton);
  const SecondaryIcon = secondaryButton?.icon;

  return (
    <div className="mx-2 my-0.5 flex h-9 items-stretch overflow-hidden text-[13px] font-medium transition-colors duration-150">
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "group flex h-full min-w-0 flex-1 items-center gap-2.5 px-3 text-left transition-colors duration-150 cursor-pointer",
          shouldShowSecondaryButton ? "rounded-l-md rounded-r-none" : "rounded-md",
          "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-150 text-sidebar-foreground/60 group-hover:text-sidebar-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate">{title}</span>
      </button>

      {shouldShowSecondaryButton && secondaryButton && SecondaryIcon ? (
        <Link
          href={secondaryButton.href}
          aria-label={secondaryButton.title}
          className={cn(
            "flex h-full w-9 shrink-0 items-center justify-center border-l border-border transition-colors duration-150 cursor-pointer rounded-r-md rounded-l-none",
            "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )}
        >
          <SecondaryIcon className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}