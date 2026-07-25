"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
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
  description?: string | null;
};

type SearchableComboboxProps = {
  /** Items to show (caller should exclude already-selected ones). */
  items: ComboboxItem[];
  onSelect: (item: ComboboxItem) => void;
  /** If provided, items are fetched on demand instead of filtered locally. */
  loadItems?: (
    search: string,
    page: number,
    signal: AbortSignal,
  ) => Promise<{ items: ComboboxItem[]; hasMore: boolean }>;
  /** If provided, a "Create X" option appears when the typed name has no exact match. */
  onCreate?: (name: string) => void;
  /** If provided, a blank "Create one" option appears at the top of the list. */
  onCreateBlank?: () => void;
  createBlankLabel?: string;
  /** Label on the trigger button. */
  triggerLabel?: string;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  triggerDataTourTarget?: string;
};

export function SearchableCombobox({
  items,
  onSelect,
  loadItems,
  onCreate,
  onCreateBlank,
  createBlankLabel = "Create one",
  triggerLabel = "Add",
  placeholder = "Search…",
  emptyText = "No results",
  disabled,
  triggerDataTourTarget,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [asyncItems, setAsyncItems] = useState<ComboboxItem[]>([]);
  const [asyncPage, setAsyncPage] = useState(0);
  const [asyncHasMore, setAsyncHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  const trimmed = search.trim();
  const sourceItems = loadItems ? asyncItems : items;
  const filtered = loadItems
    ? sourceItems
    : sourceItems.filter(
        (item) =>
          !trimmed || item.name.toLowerCase().includes(trimmed.toLowerCase()),
      );
  const showInitialLoading = isLoading && sourceItems.length === 0;
  const showAppendLoading = isLoading && sourceItems.length > 0;
  const canCreate =
    !!onCreate &&
    trimmed !== "" &&
    !isLoading &&
    !sourceItems.some((item) => item.name.toLowerCase() === trimmed.toLowerCase());

  useEffect(() => {
    if (!loadItems || !open) return;

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(async () => {
      setAsyncItems([]);
      setAsyncPage(0);
      setAsyncHasMore(true);
      setIsLoading(true);
      try {
        const result = await loadItems(trimmed, 1, controller.signal);
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setAsyncItems(result.items);
          setAsyncPage(1);
          setAsyncHasMore(result.hasMore);
        }
      } catch {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setAsyncItems([]);
          setAsyncPage(0);
          setAsyncHasMore(false);
        }
      } finally {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadItems, open, trimmed]);

  async function loadMore() {
    if (!loadItems || !open || isLoading || !asyncHasMore) return;

    const nextPage = asyncPage + 1;
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    setIsLoading(true);

    try {
      const result = await loadItems(trimmed, nextPage, controller.signal);
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;

      setAsyncItems((current) => [...current, ...result.items]);
      setAsyncPage(nextPage);
      setAsyncHasMore(result.hasMore);
    } catch {
      if (!controller.signal.aborted && requestId === requestIdRef.current) {
        setAsyncHasMore(false);
      }
    } finally {
      if (!controller.signal.aborted && requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }

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
        if (!value) {
          setSearch("");
          setAsyncItems([]);
          setIsLoading(false);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="h-9 w-full justify-between gap-2 overflow-hidden rounded-full border-border/70 bg-background/85 px-3.5 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-background hover:shadow-md"
          disabled={disabled}
          data-tour-target={triggerDataTourTarget}
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
            {sourceItems.length > 0 && !isLoading && (
              <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                {filtered.length}/{sourceItems.length}
              </span>
            )}
          </div>
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (canCreate) {
                  handleCreate();
                } else if (filtered.length > 0) {
                  const exactMatch = filtered.find(
                    (item) => item.name.toLowerCase() === trimmed.toLowerCase(),
                  );
                  handleSelect(exactMatch ?? filtered[0]);
                }
              }
            }}
            placeholder={placeholder}
            className="h-9 rounded-xl border-border/70 bg-background/90 text-base shadow-sm focus-visible:ring-0 md:text-sm"
          />
        </div>

        <div
          className="max-h-56 overflow-y-auto p-2"
          onScroll={(event) => {
            if (!loadItems || isLoading || !asyncHasMore) return;
            const el = event.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 32) {
              void loadMore();
            }
          }}
        >
          {showInitialLoading && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-xs">Loading…</p>
            </div>
          )}

          {onCreateBlank && (
            <button
              type="button"
              className="mb-1 flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-primary transition-colors hover:bg-primary/8"
              onClick={() => {
                setOpen(false);
                setSearch("");
                onCreateBlank();
              }}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm leading-none">
                +
              </span>
              <span className="truncate">{createBlankLabel}</span>
            </button>
          )}

          {filtered.length === 0 && !canCreate && trimmed !== "" && (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          )}

          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/70"
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
              {item.description ? (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {item.description}
                </span>
              ) : null}
            </button>
          ))}

          {showAppendLoading && (
            <div className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p className="text-xs">Loading more…</p>
            </div>
          )}

          {canCreate && (
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-primary transition-colors hover:bg-primary/8"
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
