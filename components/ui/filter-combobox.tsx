"use client";

/**
 * FilterCombobox — a reusable popover-based single-select filter.
 *
 * Features:
 *  - Optional search input (searchable prop, default true)
 *  - X row + separator to clear an active filter
 *  - Checkmark next to the selected item
 *  - Color dot for items with a color property
 *  - secondary variant trigger when a filter is active; chevron rotates when open
 *
 * This is the shared UI primitive used by role and tag filter buttons.
 */
import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type FilterComboboxItem = {
  id: string;
  name: string;
  color?: string | null;
};

interface FilterComboboxProps {
  items: FilterComboboxItem[];
  selectedId: string | null;
  /** Text shown in trigger when nothing is selected, and as the label for the "clear" option. */
  allLabel?: string;
  /** Search input placeholder. Only shown when searchable is true. */
  placeholder?: string;
  /** Show a search input above the list. Default: true. */
  searchable?: boolean;
  /** aria-label for the trigger button. */
  ariaLabel?: string;
  /** Called when the user picks an item or clears the filter (id = null). */
  onSelect: (id: string | null) => void;
}

export function FilterCombobox({
  items,
  selectedId,
  allLabel = "All",
  placeholder = "Search…",
  searchable = true,
  ariaLabel,
  onSelect,
}: FilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;
  const filtered =
    !searchable || !search.trim()
      ? items
      : items.filter((i) =>
          i.name.toLowerCase().includes(search.trim().toLowerCase()),
        );

  function handleSelect(id: string | null) {
    setOpen(false);
    setSearch("");
    onSelect(id);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className={cn(
            "w-full justify-between gap-1.5",
            selectedId && "border-primary/40 bg-primary/5 text-primary",
          )}
          aria-label={ariaLabel}
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {selectedItem ? (
              <>
                {selectedItem.color && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: selectedItem.color }}
                  />
                )}
                <span className="truncate font-medium">{selectedItem.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{allLabel}</span>
            )}
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
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {searchable && (
          <div className="border-b px-2 py-1.5">
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="h-7 border-0 shadow-none focus-visible:ring-0 text-sm"
            />
          </div>
        )}
        <ul className="max-h-52 overflow-y-auto p-1">
          {selectedId && (
            <>
              <li>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => handleSelect(null)}
                >
                  <X className="h-3.5 w-3.5 shrink-0" />
                  <span>{allLabel}</span>
                </button>
              </li>
              <li role="separator" className="-mx-1 my-1 h-px bg-border" />
            </>
          )}
          {filtered.length === 0 ? (
            <li className="px-2 py-4 text-center text-xs text-muted-foreground">
              No results
            </li>
          ) : (
            filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleSelect(item.id)}
                >
                  {item.color && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  <span className="flex-1 truncate text-left">{item.name}</span>
                  {item.id === selectedId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
