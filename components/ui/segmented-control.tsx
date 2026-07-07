"use client";

import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string = string> = {
  label: React.ReactNode;
  value: T;
};

type BaseProps<T extends string> = {
  options: SegmentOption<T>[];
  disabled?: boolean;
  className?: string;
  /**
   * "connected" (default) — buttons share a single bordered bar.
   * "pills"               — individual spaced buttons; good for multi-select.
   */
  variant?: "connected" | "pills";
  /**
   * "default" — px-3 py-1 (text labels).
   * "sm"      — p-1.5 (icon-only buttons).
   */
  size?: "default" | "sm";
};

type SingleProps<T extends string> = BaseProps<T> & {
  multiple?: false;
  value: T;
  onChange: (value: T) => void;
};

type MultipleProps<T extends string> = BaseProps<T> & {
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
};

export type SegmentedControlProps<T extends string = string> =
  | SingleProps<T>
  | MultipleProps<T>;

export function SegmentedControl<T extends string>(
  props: SingleProps<T>,
): ReactElement;
export function SegmentedControl<T extends string>(
  props: MultipleProps<T>,
): ReactElement;
export function SegmentedControl<T extends string>({
  options,
  disabled,
  className,
  variant = "connected",
  size = "default",
  ...rest
}: SegmentedControlProps<T>): ReactElement {
  const isActive = (v: T) => {
    if (rest.multiple) return (rest.value as T[]).includes(v);
    return (rest.value as T) === v;
  };

  const handleClick = (v: T) => {
    if (disabled) return;
    if (rest.multiple) {
      const current = rest.value as T[];
      const next = current.includes(v)
        ? current.filter((x) => x !== v)
        : [...current, v];
      (rest.onChange as (value: T[]) => void)(next);
    } else {
      (rest.onChange as (value: T) => void)(v);
    }
  };

  if (variant === "pills") {
    return (
      <div
        className={cn(
          "inline-flex w-fit flex-wrap gap-1.5 rounded-full border border-border/70 bg-muted/35 p-0.5 shadow-sm",
          className,
        )}
      >
        {options.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleClick(value)}
            disabled={disabled}
            aria-pressed={isActive(value)}
            className={cn(
              "inline-flex h-8 items-center justify-center rounded-full px-2.5 text-xs font-medium border transition-all duration-150 cursor-pointer select-none whitespace-nowrap leading-none",
              "disabled:pointer-events-none disabled:opacity-50",
              isActive(value)
                ? "bg-background text-foreground border-border shadow-sm ring-1 ring-black/5"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-background/80 hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  // connected bar
  return (
    <div
      className={cn(
        "inline-flex w-fit overflow-hidden rounded-full border border-border/70 bg-muted/35 p-0.5 text-xs font-medium shadow-sm",
        className,
      )}
    >
      {options.map(({ label, value }) => (
        <button
          key={value}
          type="button"
          onClick={() => handleClick(value)}
          disabled={disabled}
          aria-pressed={isActive(value)}
          className={cn(
            size === "sm" ? "h-8 px-2.5" : "h-9 px-3.5",
            "inline-flex items-center justify-center rounded-full transition-all duration-150 cursor-pointer select-none text-center whitespace-nowrap leading-none",
            "disabled:pointer-events-none disabled:opacity-50",
            isActive(value)
              ? "bg-background text-foreground shadow-sm ring-1 ring-black/5"
              : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
