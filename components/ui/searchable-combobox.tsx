"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ComboboxItem = {
  id: string;
  name: string;
  color?: string | null;
};

type SearchableComboboxProps = {
  /** Items to show (caller should exclude already-selected ones). */
  items: ComboboxItem[];
  onSelect: (item: ComboboxItem) => void;
  /** If provided, a "Create X" option appears when the typed name has no exact match. */
  onCreate?: (name: string) => void;
  /** Label on the trigger button. */
  triggerLabel?: string;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
};

export function SearchableCombobox({
  items,
  onSelect,
  onCreate,
  triggerLabel = "Add",
  placeholder = "Search…",
  emptyText = "No results",
  disabled,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const trimmed = search.trim();
  const filtered = items.filter(
    (item) =>
      !trimmed || item.name.toLowerCase().includes(trimmed.toLowerCase()),
  );
  const canCreate =
    !!onCreate &&
    trimmed !== "" &&
    !items.some((item) => item.name.toLowerCase() === trimmed.toLowerCase());

  const handleSelect = (item: ComboboxItem) => {
    setOpen(false);
    setSearch("");
    onSelect(item);
  };

  const handleCreate = () => {
    if (!onCreate || !trimmed) return;
    const name = trimmed;
    setOpen(false);
    setSearch("");
    onCreate(name);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="h-9 w-full justify-between gap-2 overflow-hidden rounded-full border-border/70 bg-background/85 px-3.5 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-background hover:shadow-md"
          disabled={disabled}
        >
          <span className="truncate text-sm font-medium">{triggerLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        collisionPadding={8}
        className="w-80 overflow-hidden rounded-2xl border-border/70 bg-popover/95 p-0 shadow-xl backdrop-blur-xl"
        style={{ minWidth: "var(--radix-popover-trigger-width)" }}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="border-b border-border/60 bg-background/70 px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {triggerLabel}
            </p>
            {items.length > 0 && (
              <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                {filtered.length}/{items.length}
              </span>
            )}
          </div>
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={placeholder}
            className="h-9 rounded-xl border-border/70 bg-background/90 text-sm shadow-sm focus-visible:ring-0"
          />
        </div>

        <div className="max-h-56 overflow-y-auto p-2">
          {filtered.length === 0 && !canCreate && trimmed !== "" && (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          )}

          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/70"
              onClick={() => handleSelect(item)}
            >
              {item.color && (
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span className="truncate font-medium text-foreground">
                {item.name}
              </span>
            </button>
          ))}

          {canCreate && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-primary transition-colors hover:bg-primary/8"
              onClick={handleCreate}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm leading-none">
                +
              </span>
              <span className="truncate">Create &ldquo;{trimmed}&rdquo;</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
