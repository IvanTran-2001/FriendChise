"use client";

import { useState, useTransition, useEffect } from "react";
import { GripVertical, Search, MapPin, Loader2, LayoutGrid, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

import { cn } from "@/lib/utils";
import { addToolItemListEntryAtPositionAction } from "@/app/actions/tools";
import { usePersistedState } from "@/hooks/use-persisted-state";

export type PickableItem = {
  id: string;
  name: string;
  unit: string;
  imgUrl: string | null;
  imageSignedUrl: string | null;
};

interface AddItemToListPanelProps {
  orgId: string;
  listId: string;
  availableItems: PickableItem[];
  /** Pre-fill position defaults (1-indexed). */
  defaultPage?: number;
  defaultCol?: number;
  defaultRow?: number;
  gridCols?: number;
  gridRows?: number;
  onModeChange?: (mode: "grid" | "manual") => void;
  onAdded: (entry: unknown) => void;
  onClose: () => void;
  /** Fired in manual mode whenever the computed target position changes. */
  onPositionChange?: (position: number) => void;
  /** Grid mode: called when user picks an item; parent handles cell selection. */
  onItemPicked?: (item: PickableItem) => void;
}

export function AddItemToListPanel({
  orgId,
  listId,
  availableItems,
  defaultPage = 1,
  defaultCol = 1,
  defaultRow = 1,
  gridCols = 4,
  gridRows = 4,
  onModeChange,
  onAdded,
  onClose,
  onPositionChange,
  onItemPicked,
}: AddItemToListPanelProps) {
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<PickableItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = usePersistedState<"grid" | "manual">(
    `item-list-add-item-mode-${orgId}-${listId}`,
    "grid",
  );

  const pageSize = gridCols * gridRows;

  // ── Manual mode state ────────────────────────────────────────────────────
  const [page, setPage] = useState(String(defaultPage));
  const [col, setCol] = useState(String(defaultCol));
  const [row, setRow] = useState(String(defaultRow));

  const filtered = availableItems.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  );

  // ── Manual position derived value ────────────────────────────────────────────
  const parsedPage = parseInt(page);
  const parsedCol = parseInt(col);
  const parsedRow = parseInt(row);
  const maxRows = Math.ceil(pageSize / gridCols);
  const manualPosition =
    !isNaN(parsedPage) && !isNaN(parsedCol) && !isNaN(parsedRow) &&
    parsedCol >= 1 && parsedCol <= gridCols &&
    parsedRow >= 1 && parsedRow <= maxRows
      ? (parsedPage - 1) * pageSize + (parsedRow - 1) * gridCols + (parsedCol - 1)
      : -1;

  useEffect(() => {
    if (mode === "manual" && manualPosition >= 0) onPositionChange?.(manualPosition);
  }, [mode, manualPosition]); // eslint-disable-line react-hooks/exhaustive-deps

  function setAddItemMode(nextMode: "grid" | "manual") {
    setMode(nextMode);
    onModeChange?.(nextMode);
  }

  function handleSelectItem(item: PickableItem) {
    if (isPending) return;

    if (mode === "grid") {
      // Grid mode: notify parent to handle cell selection.
      onItemPicked?.(item);
      return;
    }

    // Manual mode: place immediately using the typed position
    if (selectedItem?.id === item.id) {
      setSelectedItem(null);
      return;
    }
    setSelectedItem(item);
    if (manualPosition < 0) return;
    startTransition(async () => {
      const result = await addToolItemListEntryAtPositionAction(
        orgId,
        listId,
        item.id,
        manualPosition,
      );
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to add item.");
        return;
      }
      toast.success(`"${item.name}" added.`);
      onAdded(result.entry);
      onClose();
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mode toggle + position */}
      <div className="px-4 pt-4 pb-3 border-b border-border flex flex-col gap-3">
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5 w-fit">
          <button
            onClick={() => setAddItemMode("grid")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
              mode === "grid"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-3 w-3" />
            Select Cell
          </button>
          <button
            onClick={() => setAddItemMode("manual")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
              mode === "manual"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Manual
          </button>
        </div>

        {mode === "grid" ? (
          <p className="text-xs text-muted-foreground">
            Pick an item below — then tap a cell in the grid to place it.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>Position</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Page</label>
                <Input type="number" min="1" value={page} onChange={(e) => setPage(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Col</label>
                <Input type="number" min="1" max={gridCols} value={col} onChange={(e) => setCol(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Row</label>
                <Input type="number" min="1" max={gridRows} value={row} onChange={(e) => setRow(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
          </div>
        )}

        {isPending && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Adding...
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-4 pt-3 pb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            autoFocus
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="flex flex-col divide-y rounded-lg border overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">
              {search ? `No items match "${search}"` : "No items available to add."}
            </p>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/new-item-id", item.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => handleSelectItem(item)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors select-none",
                  selectedItem?.id === item.id && "bg-primary/5",
                )}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.unit}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
