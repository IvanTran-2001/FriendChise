/**
 * ConversionClient — client component for `/orgs/[orgId]/tools/conversion`.
 *
 * Renders a searchable grid of ConversionSets sorted by most recently updated.
 * Each card links to the set's detail page and has an inline edit button that
 * opens `EditSetForm` in the ActionSidebar.
 *
 * `formKeyRef` increments on every open so the sidebar always remounts the
 * form even when the same set is edited twice in a row, clearing dirty state.
 */
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Toolbar } from "@/components/layout/toolbar";
import { SearchInput } from "@/components/ui/search-input";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { EditSetForm } from "./_components/edit-set-form";
import { cn } from "@/lib/utils";

interface ConversionSet {
  id: string;
  name: string;
  updatedAt: Date;
}

interface ConversionClientProps {
  orgId: string;
  sets: ConversionSet[];
}

export function ConversionClient({ orgId, sets }: ConversionClientProps) {
  const [search, setSearch] = useState("");
  const { open, close, activeTitle } = useActionSidebar();
  const formKeyRef = useRef(0);

  const filtered = sets.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleEdit(e: React.MouseEvent, set: ConversionSet) {
    e.preventDefault();
    const k = ++formKeyRef.current;
    open(
      `Edit: ${set.name}`,
      <div key={k} className="p-4">
        <EditSetForm orgId={orgId} set={set} onClose={close} />
      </div>,
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Toolbar>
        <SearchInput
          placeholder="Search conversion sets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </Toolbar>

      <div className="flex-1 overflow-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
            <p className="text-sm text-muted-foreground">
              {sets.length === 0
                ? `No sets yet. Use "+ Add Set" to create one.`
                : "No sets match your search."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
            {filtered.map((set) => (
              <Link
                key={set.id}
                href={`/orgs/${orgId}/tools/conversion/${set.id}`}
                className={cn(
                  "flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm",
                  "hover:border-primary/40 hover:shadow-md transition-all cursor-pointer",
                  activeTitle === `Edit: ${set.name}` && "border-primary/40",
                )}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium truncate">{set.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(set.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <button
                  onClick={(e) => handleEdit(e, set)}
                  className="ml-3 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={`Edit ${set.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
