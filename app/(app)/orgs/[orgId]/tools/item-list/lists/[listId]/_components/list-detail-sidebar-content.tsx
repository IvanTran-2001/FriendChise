"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckSquare, LayoutGrid, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/controls/segmented-control";
import { SearchableCombobox } from "@/components/ui/comboboxes/searchable-combobox";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
import { updateToolItemGridConfigAction } from "@/app/actions/tools";

const MIN_COLS = 1, MAX_COLS = 8, MIN_ROWS = 1, MAX_ROWS = 8;

interface ListDetailSidebarContentProps {
  orgId: string;
  listId: string;
  view: "grid" | "checklist";
  canManage: boolean;
  gridCols?: number;
  gridRows?: number;
  conversionSets: { id: string; name: string }[];
  activeSetId: string | null;
  /** Called when the user clicks "Add Item" — handled by the parent which has highlight state. */
  onOpenAddItem?: () => void;
  onViewChange?: (view: "grid" | "checklist") => void;
}

export function ListDetailSidebarContent({
  orgId,
  listId,
  view,
  canManage,
  gridCols: initialCols = 4,
  gridRows: initialRows = 4,
  conversionSets,
  activeSetId,
  onOpenAddItem,
  onViewChange,
}: ListDetailSidebarContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeTitle } = useActionSidebar();
  const base = `/orgs/${orgId}/tools/item-list/lists/${listId}`;
  const RATES_PREF_KEY = `item-list-rates-prefs-${orgId}`;
  const [cols, setCols] = useState(initialCols);
  const [rows, setRows] = useState(initialRows);
  const [isGridPending, startGridTransition] = useTransition();

  /**
   * Persists the selected conversion set to a 1-year cookie so the server can
   * restore it on the next visit via the `?set=` URL param fallback in
   * `lists/[listId]/page.tsx`. Mirrors the timetable preference pattern.
   */
  function saveRatesPref(setId: string | null) {
    try {
      const value = JSON.stringify({ setId });
      document.cookie = `${RATES_PREF_KEY}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch { /* ignore */ }
  }

  function navigate(updates: Record<string, string | null>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (val === null) p.delete(key);
      else p.set(key, val);
    }
    router.replace(`${base}?${p.toString()}`, { scroll: false });
  }

  function changeGrid(newCols: number, newRows: number) {
    const prevCols = cols;
    const prevRows = rows;
    setCols(newCols);
    setRows(newRows);
    startGridTransition(async () => {
      const result = await updateToolItemGridConfigAction(orgId, listId, newCols, newRows);
      if (!result.ok) {
        setCols(prevCols);
        setRows(prevRows);
        toast.error("Failed to update grid size.");
      }
    });
  }

  return (
    <>
      {/* ── Nav: always visible ─────────────────────────────── */}
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-3 border-t border-border">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1">
            View
          </span>
          <SegmentedControl
            value={view}
            onChange={(v) => onViewChange?.(v)}
            options={[
              {
                value: "grid",
                label: (
                  <span className="flex items-center gap-1.5">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Grid
                  </span>
                ),
              },
              {
                value: "checklist",
                label: (
                  <span className="flex items-center gap-1.5">
                    <CheckSquare className="h-3.5 w-3.5" />
                    Checklist
                  </span>
                ),
              },
            ]}
          />

          {/* Display toggles removed — amounts and rates always shown */}
        </div>
      </div>

      {/* ── Apply Rates ─────────────────────────────────────── */}
      <div className="px-3 py-3 flex flex-col gap-2 border-t border-border">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1">
          Apply Rates
        </span>
        {conversionSets.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">
            No conversion sets yet.
          </p>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <SearchableCombobox
                items={conversionSets}
                onSelect={(item) => {
                  saveRatesPref(item.id);
                  navigate({ set: item.id });
                }}
                triggerLabel={
                  conversionSets.find((s) => s.id === activeSetId)?.name ?? "Choose set…"
                }
                placeholder="Search sets…"
              />
            </div>
            {activeSetId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => { saveRatesPref(null); navigate({ set: null }); }}
                aria-label="Clear set"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Grid actions ────────────────────────────────────── */}
      {canManage && view === "grid" && (
        <div className="px-3 py-3 flex flex-col gap-3 border-t border-border">
          <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1">
            Grid
          </span>

          {/* Grid size */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground px-1">Cols</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={cols <= MIN_COLS || isGridPending} onClick={() => changeGrid(cols - 1, rows)}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="tabular-nums text-sm w-5 text-center">{cols}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={cols >= MAX_COLS || isGridPending} onClick={() => changeGrid(cols + 1, rows)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground px-1">Rows</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={rows <= MIN_ROWS || isGridPending} onClick={() => changeGrid(cols, rows - 1)}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="tabular-nums text-sm w-5 text-center">{rows}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={rows >= MAX_ROWS || isGridPending} onClick={() => changeGrid(cols, rows + 1)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Grid actions */}
          <Button
            size="sm"
            variant={activeTitle === "Add Item" ? "default" : "outline"}
            className="w-full justify-start gap-2"
            onClick={() => onOpenAddItem?.()}
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>
      )}

      {/* ── Checklist actions ───────────────────────────────── */}
      {canManage && view === "checklist" && (
        <div className="px-3 py-3 flex flex-col gap-2 border-t border-border">
          <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1">
            Checklist
          </span>
          <Button
            size="sm"
            variant={activeTitle === "Add Item" ? "default" : "outline"}
            className="w-full justify-start gap-2"
            onClick={() => onOpenAddItem?.()}
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>
      )}
    </>
  );
}
