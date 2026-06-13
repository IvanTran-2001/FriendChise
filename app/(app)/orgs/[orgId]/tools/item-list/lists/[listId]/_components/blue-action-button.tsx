"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BlueActionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
}

export function BlueActionButton({
  children,
  onClick,
  disabled,
  icon,
  className,
  type = "button",
}: BlueActionButtonProps) {
  return (
    <Button
      type={type}
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group w-full justify-start gap-2 rounded-xl border border-primary/10 bg-primary text-primary-foreground shadow-sm shadow-primary/15 transition-all hover:bg-primary/90 hover:shadow-md hover:shadow-primary/20 hover:ring-2 hover:ring-primary/25 hover:ring-offset-1 active:scale-[0.99] disabled:opacity-60",
        className,
      )}
    >
      {icon && (
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary-foreground/15 text-primary-foreground transition-colors group-hover:bg-primary-foreground/20">
          {icon}
        </span>
      )}
      <span className="font-medium tracking-tight">{children}</span>
    </Button>
  );
}