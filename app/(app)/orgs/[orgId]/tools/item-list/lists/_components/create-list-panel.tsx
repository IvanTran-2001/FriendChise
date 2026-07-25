"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckSquare, LayoutGrid } from "lucide-react";
import { ListDisplayType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/controls/segmented-control";
import { createToolItemListAction } from "@/app/actions/tools";

type CreatedList = {
  id: string;
  name: string;
  description: string | null;
  displayType: ListDisplayType;
  updatedAt: Date;
  _count: { entries: number };
};

interface CreateListPanelProps {
  orgId: string;
  onCreated: (list: CreatedList) => void;
  onClose: () => void;
}

export function CreateListPanel({ orgId, onCreated, onClose }: CreateListPanelProps) {
  const [name, setName] = useState("");
  const [displayType, setDisplayType] = useState<"GRID" | "CHECKLIST">("CHECKLIST");
  const [gridCols, setGridCols] = useState(4);
  const [gridRows, setGridRows] = useState(4);
  const [isPending, startTransition] = useTransition();

  function handleGridColsChange(value: string) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    setGridCols(Math.max(1, Math.min(12, parsed)));
  }

  function handleGridRowsChange(value: string) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    setGridRows(Math.max(1, Math.min(20, parsed)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createToolItemListAction(orgId, name, displayType, gridCols, gridRows);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to create set.");
        return;
      }
      toast.success(`"${name.trim()}" created.`);
      onCreated(result.list);
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-list-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="new-list-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Morning Prep"
          required
          autoFocus
          disabled={isPending}
        />
      </div>

      {/* Display type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Type</label>
        <SegmentedControl
          value={displayType}
          onChange={setDisplayType}
          disabled={isPending}
          options={[
            {
              value: "CHECKLIST",
              label: (
                <span className="flex items-center gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5" />
                  Checklist
                </span>
              ),
            },
            {
              value: "GRID",
              label: (
                <span className="flex items-center gap-1.5">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Station Layout
                </span>
              ),
            },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          {displayType === "CHECKLIST"
            ? "A simple list to check off — best for prep and cleaning tasks."
            : "A spatial grid where each item has its own position — best for mapping a physical shelf or station."}
        </p>
      </div>

      {/* Grid config — only relevant for Station Layout lists */}
      {displayType === "GRID" && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3 bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Grid config
          </span>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="grid-cols" className="text-sm font-medium">
                Columns
              </label>
              <Input
                id="grid-cols"
                type="number"
                min={1}
                max={12}
                value={gridCols}
                onChange={(e) => handleGridColsChange(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="grid-rows" className="text-sm font-medium">
                Rows
              </label>
              <Input
                id="grid-rows"
                type="number"
                min={1}
                max={20}
                value={gridRows}
                onChange={(e) => handleGridRowsChange(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending || !name.trim()}
        className="w-full"
      >
        {isPending ? "Creating…" : "Create Set"}
      </Button>
    </form>
  );
}
