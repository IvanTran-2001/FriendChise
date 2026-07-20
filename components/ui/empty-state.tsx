/**
 * EmptyState — shared "nothing here yet" placeholder for list/grid views.
 *
 * Standardizes the icon size (h-10 w-10), spacing (py-24), and title style
 * that were previously duplicated with slightly different values across
 * Tasks, Item-List, Announcements, and Conversion empty states.
 *
 * For "no results match your search" states, prefer a plain muted text line
 * instead of this component — it's intentionally lighter-weight than the
 * first-time empty state.
 */
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/core/utils";

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const isExternalHref = action?.href ? /^https?:\/\//i.test(action.href) : false;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg border py-24",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Icon className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-2xl font-semibold tracking-tight">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        )}
        {action &&
          (action.href ? (
            isExternalHref ? (
              <a
                href={action.href}
                className="text-sm text-primary hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {action.label}
              </a>
            ) : (
              <Link href={action.href} className="text-sm text-primary hover:underline">
                {action.label}
              </Link>
            )
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="text-sm text-primary hover:underline cursor-pointer"
            >
              {action.label}
            </button>
          ))}
      </div>
    </div>
  );
}
