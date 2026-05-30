"use client";

import { useState, useTransition } from "react";
import { Check, List, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import { cn } from "@/lib/utils";
import { toggleChecklistEntryAction } from "@/app/actions/tools";
import type { ListDetail } from "./list-detail-client";

interface ListChecklistViewProps {
  orgId: string;
  list: ListDetail;
  canManage: boolean;
}

export function ListChecklistView({
  orgId,
  list,
  canManage,
}: ListChecklistViewProps) {
  const [entries, setEntries] = useState(list.entries);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = search
    ? entries.filter((e) =>
        e.item.name.toLowerCase().includes(search.toLowerCase()),
      )
    : entries;

  function handleToggle(entryId: string) {
    if (!canManage || pending) return;
    // Optimistic update
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? {
              ...e,
              checklistEntry: e.checklistEntry
                ? null
                : { id: "optimistic", listEntryId: entryId, checkedAt: new Date() },
            }
          : e,
      ),
    );
    startTransition(async () => {
      const result = await toggleChecklistEntryAction(entryId, list.id, orgId);
      if (!result.ok) {
        // Revert on failure
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entryId
              ? {
                  ...e,
                  checklistEntry: e.checklistEntry
                    ? null
                    : { id: "optimistic", listEntryId: entryId, checkedAt: new Date() },
                }
              : e,
          ),
        );
      }
    });
  }

  return (
    <>
      <RegisterPageToolbar>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            aria-label="Search items"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-7"
          />
        </div>
      </RegisterPageToolbar>

      <div>
        {entries.length === 0 ? (
          <div className="flex items-center justify-center border rounded-lg py-24">
            <div className="flex flex-col items-center gap-3 text-center">
              <List className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-2xl font-semibold">No items in this list</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center border rounded-lg py-16">
            <p className="text-sm text-muted-foreground">
              No items match &ldquo;{search}&rdquo;
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border overflow-hidden bg-card shadow-sm">
            {filtered.map((entry) => {
              const checked = !!entry.checklistEntry;
              return (
                <div
                  key={entry.id}
                  role={canManage ? "button" : undefined}
                  tabIndex={canManage ? 0 : undefined}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors",
                    canManage && "cursor-pointer hover:bg-muted/50",
                    checked && "bg-muted/30",
                  )}
                  onClick={() => handleToggle(entry.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleToggle(entry.id);
                    }
                  }}
                >
                  {/* Custom checkbox */}
                  <div
                    className={cn(
                      "h-5 w-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors",
                      checked
                        ? "bg-primary border-primary"
                        : "border-border bg-background",
                    )}
                  >
                    {checked && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        checked && "line-through text-muted-foreground",
                      )}
                    >
                      {entry.item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.amount} {entry.item.unit}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
