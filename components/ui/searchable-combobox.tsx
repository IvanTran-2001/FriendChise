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
          className="w-full justify-between gap-1.5"
          disabled={disabled}
        >
          <span>{triggerLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0"
        style={{ minWidth: "var(--radix-popover-trigger-width)" }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b px-1 py-1">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="h-7 border-0 shadow-none focus-visible:ring-0 text-sm"
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {filtered.length === 0 && !canCreate && trimmed !== "" && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {emptyText}
            </p>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
              onClick={() => handleSelect(item)}
            >
              {item.color && (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
              )}
              {item.name}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-1.5 text-primary"
              onClick={handleCreate}
            >
              <span className="text-base leading-none">+</span>
              Create &ldquo;{trimmed}&rdquo;
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
