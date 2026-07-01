"use client";

import { useState, useTransition } from "react";
import { CheckSquare, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { ListDisplayType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createToolItemListAction } from "@/app/actions/tools";

const DISPLAY_OPTIONS: {
  value: ListDisplayType;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    value: "GRID",
    label: "Grid",
    icon: LayoutGrid,
    description: "Cards arranged in a configurable grid",
  },
  {
    value: "CHECKLIST",
    label: "Checklist",
    icon: CheckSquare,
    description: "Tick off items as they're prepared",
  },
];

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
  const [displayType, setDisplayType] = useState<ListDisplayType>("GRID");
  const [gridCols, setGridCols] = useState(4);
  const [gridRows, setGridRows] = useState(4);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createToolItemListAction(
        orgId,
        name,
        displayType,
        displayType === "GRID" ? gridCols : undefined,
        displayType === "GRID" ? gridRows : undefined,
      );
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
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Display type</span>
        <div className="grid grid-cols-2 gap-2">
          {DISPLAY_OPTIONS.map(({ value, label, icon: Icon, description }) => {
            const selected = displayType === value;
            return (
              <button
                key={value}
                type="button"
                disabled={isPending}
                onClick={() => setDisplayType(value)}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 ${selected ? "text-primary" : ""}`} />
                <span className={`text-xs font-medium ${selected ? "text-foreground" : ""}`}>
                  {label}
                </span>
                <span className="text-[11px] leading-tight">{description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* GRID-specific config */}
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
                onChange={(e) => setGridCols(Math.max(1, Math.min(12, Number(e.target.value))))}
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
                onChange={(e) => setGridRows(Math.max(1, Math.min(20, Number(e.target.value))))}
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
