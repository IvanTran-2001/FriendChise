/**
 * Badge — shared pill/chip component for status, role, and metadata labels.
 *
 * Replaces the hand-rolled badge markup that used to be duplicated (with
 * slightly different radius/padding/text-size per feature) across tasks,
 * memberships, timetable, and notifications.
 *
 * Use `color` for per-entity colors (roles, tags) — it renders a bordered
 * pill tinted with `${color}22` background + `color` text, matching the
 * existing role/tag color convention. Use `variant` for semantic states.
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/core/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full font-medium whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        success: "bg-green-500/10 text-green-600 dark:text-green-400",
        warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        error: "bg-red-500/10 text-red-500 dark:text-red-400",
        info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
        emerald:
          "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
        blue:
          "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400",
        "destructive-outline":
          "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20",
        outline: "border bg-transparent text-foreground",
      },
      size: {
        default: "px-2 py-0.5 text-xs",
        sm: "px-1.5 py-0.5 text-[10px]",
      },
      shape: {
        pill: "",
        circle: "aspect-square justify-center rounded-full p-0 font-bold",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "default",
      shape: "pill",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /**
   * Custom color (hex) for per-entity badges, e.g. role/tag colors. When
   * provided, renders `${color}22` background + `color` text with a
   * border, overriding `variant`'s color classes.
   */
  color?: string;
}

function Badge({
  className,
  variant,
  size,
  shape,
  color,
  style,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        badgeVariants({ variant, size, shape }),
        color && "border",
        className,
      )}
      style={color ? { backgroundColor: `${color}22`, color, ...style } : style}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
