"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/core/utils";

export type FilterComboboxItem = {
  id: string;
  name: string;
  color?: string | null;
};

interface MultiFilterComboboxProps {
  items: FilterComboboxItem[];
  selectedIds: string[];
  /** Text shown in trigger when nothing is selected, and as the label for the "clear" option. */
  allLabel?: string;
  /** Search input placeholder. Only shown when searchable is true. */
  placeholder?: string;
  /** Show a search input above the list. Default: true. */
  searchable?: boolean;
  /** aria-label for the trigger button. */
  ariaLabel?: string;
  /** Called when the selection changes. */
  onSelect: (ids: string[]) => void;
}

export function MultiFilterCombobox({
  items,
  selectedIds,
  allLabel = "All",
  placeholder = "Search…",
  searchable = true,
  ariaLabel,
  onSelect,
}: MultiFilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered =
    !searchable || !search.trim()
      ? items
      : items.filter((i) =>
          i.name.toLowerCase().includes(search.trim().toLowerCase()),
        );

  const getTriggerLabel = () => {
    if (selectedIds.length === 0) return allLabel;
    if (selectedIds.length === 1) {
      return items.find((i) => i.id === selectedIds[0])?.name ?? allLabel;
    }
    const plural = allLabel.toLowerCase().startsWith("all ")
      ? allLabel.substring(4)
      : allLabel;
    const capitalized = plural.charAt(0).toUpperCase() + plural.slice(1);
    return `${capitalized} (${selectedIds.length})`;
  };

  const selectedItem =
    selectedIds.length === 1
      ? items.find((i) => i.id === selectedIds[0]) ?? null
      : null;

  function handleToggle(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    onSelect(next);
  }

  function handleClear() {
    onSelect([]);
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
            selectedIds.length > 0 && "border-primary/40 bg-primary/5 text-primary",
          )}
          aria-label={ariaLabel}
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {selectedIds.length === 1 && selectedItem ? (
              <>
                {selectedItem.color && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: selectedItem.color }}
                  />
                )}
                <span className="truncate font-medium">{selectedItem.name}</span>
              </>
            ) : selectedIds.length > 1 ? (
              <span className="truncate font-medium">{getTriggerLabel()}</span>
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
        className="w-auto min-w-32 p-0 max-w-[calc(100vw-32px)] md:max-w-none"
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
              className="h-7 border-0 shadow-none focus-visible:ring-0 text-base md:text-sm"
            />
          </div>
        )}
        <ul
          role="menu"
          className="max-h-52 overflow-y-auto p-1"
        >
          {selectedIds.length > 0 && (
            <>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={handleClear}
                >
                  <X className="h-3.5 w-3.5 shrink-0" />
                  <span>Clear selection</span>
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
            filtered.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <li key={item.id} role="none">
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={isSelected}
                    className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={() => handleToggle(item.id)}
                  >
                    {item.color && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    )}
                    <span className="flex-1 truncate text-left">{item.name}</span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
