"use client";

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

export function SegmentedControl<T extends string>({
  options,
  disabled,
  className,
  variant = "connected",
  size = "default",
  ...rest
}: SegmentedControlProps<T>) {
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
      <div className={cn("flex gap-2 flex-wrap", className)}>
        {options.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleClick(value)}
            disabled={disabled}
            aria-pressed={isActive(value)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium border transition-colors cursor-pointer select-none",
              "disabled:pointer-events-none disabled:opacity-50",
              isActive(value)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white text-muted-foreground border-border hover:border-primary/50 hover:text-foreground",
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
        "flex overflow-hidden border text-sm font-medium",
        className,
      )}
    >
      {options.map(({ label, value }, i) => (
        <button
          key={value}
          type="button"
          onClick={() => handleClick(value)}
          disabled={disabled}
          aria-current={isActive(value) ? "true" : undefined}
          className={cn(
            size === "sm" ? "p-1.5" : "px-3 py-1",
            "transition-colors cursor-pointer select-none",
            "disabled:pointer-events-none disabled:opacity-50",
            i > 0 && "border-l",
            isActive(value)
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
