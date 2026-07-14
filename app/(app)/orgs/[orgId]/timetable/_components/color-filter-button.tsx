"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePersistedState } from "@/hooks/use-persisted-state";

const COLOR_OPTIONS = [
  { id: "task", name: "Color by Task" },
  { id: "role", name: "Color by Role" },
  { id: "tag", name: "Color by Tag" },
] as const;

interface ColorFilterButtonProps {
  value?: "task" | "role" | "tag";
  onChange?: (value: "task" | "role" | "tag") => void;
}

export function ColorFilterButton({ value, onChange }: ColorFilterButtonProps = {}) {
  const [open, setOpen] = useState(false);
  const [internalColorFilter, setInternalColorFilter] = usePersistedState<"task" | "role" | "tag">(
    "friendchise-color-filter",
    "task",
  );

  const colorFilter = value !== undefined ? value : internalColorFilter;
  const setColorFilter = onChange !== undefined ? onChange : setInternalColorFilter;

  const selectedOption = COLOR_OPTIONS.find((o) => o.id === colorFilter) ?? COLOR_OPTIONS[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className={cn(
            "w-full justify-between gap-1.5",
            "border-primary/40 bg-primary/5 text-primary"
          )}
          aria-label="Color filter"
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <span className="truncate font-medium">{selectedOption.name}</span>
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 opacity-50 transition-transform duration-150",
              open && "rotate-180",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-auto min-w-32 p-0"
        style={{ minWidth: "var(--radix-popover-trigger-width)" }}
      >
        <ul role="menu" className="max-h-52 overflow-y-auto p-1">
          {COLOR_OPTIONS.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setColorFilter(option.id);
                  setOpen(false);
                }}
              >
                <span className="flex-1 truncate text-left">{option.name}</span>
                {option.id === colorFilter && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
