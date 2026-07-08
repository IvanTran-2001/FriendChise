"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  GripVertical,
  MapPin,
  Loader2,
  LayoutGrid,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { SearchableCombobox, type ComboboxItem } from "@/components/ui/searchable-combobox";

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

  const loadItems = useCallback(async (query: string, page: number, signal: AbortSignal) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "24",
      search: query,
    });
    const response = await fetch(`/api/orgs/${orgId}/tools/item-list?${params.toString()}`, {
      signal,
    });
    if (!response.ok) throw new Error("Failed to load items.");

    const data = (await response.json()) as {
      items: Array<{ id: string; name: string; unit: string; imgUrl: string | null; imageSignedUrl: string | null }>;
      hasMore?: boolean;
      totalPages: number;
      page: number;
    };

    return {
      items: data.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.unit,
      })) satisfies ComboboxItem[],
      hasMore: data.page < data.totalPages,
    };
  }, [orgId]);

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
            Search and pick an item, then tap a cell in the grid to place it.
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
        <SearchableCombobox
          items={[]}
          loadItems={loadItems}
          triggerLabel={selectedItem?.name ?? "Search items"}
          placeholder="Search items…"
          emptyText="No items found"
          onSelect={(item) => {
            const pickedItem: PickableItem = {
              id: item.id,
              name: item.name,
              unit: item.description ?? "",
              imgUrl: null,
              imageSignedUrl: null,
            };
            handleSelectItem(pickedItem);
          }}
        />
      </div>

      {selectedItem && mode === "grid" && (
        <div className="px-4">
          <div
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/new-item-id", selectedItem.id);
              event.dataTransfer.effectAllowed = "copy";
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 cursor-grab select-none active:cursor-grabbing",
              "bg-muted/30",
            )}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedItem.name}</p>
              <p className="text-xs text-muted-foreground">{selectedItem.unit}</p>
            </div>
          </div>
        </div>
      )}

      {selectedItem && mode === "manual" && (
        <div className="px-4">
          <div className="rounded-lg border border-border px-3 py-2.5 bg-muted/20">
            <p className="text-sm font-medium truncate">{selectedItem.name}</p>
            <p className="text-xs text-muted-foreground">{selectedItem.unit}</p>
          </div>
        </div>
      )}

      {selectedItem === null && mode === "grid" && (
        <p className="px-4 text-xs text-muted-foreground">
          Pick an item above, then drag it onto the grid.
        </p>
      )}

      {selectedItem === null && mode === "manual" && (
        <p className="px-4 text-xs text-muted-foreground">
          Pick an item above, then it will be placed at the typed position.
        </p>
      )}
    </div>
  );
}
