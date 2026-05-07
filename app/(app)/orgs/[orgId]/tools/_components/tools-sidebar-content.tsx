"use client";

import { useState } from "react";
import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";

// Placeholder tool list — replace with DB-driven data once the Tool model exists
const PLACEHOLDER_TOOLS = [
  { id: "count", name: "Count" },
  { id: "conversion", name: "Conversion" },
];

export function ToolsSidebarContent() {
  const [search, setSearch] = useState("");

  const filtered = PLACEHOLDER_TOOLS.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Title row */}
      <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          Tools
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <SearchInput
          placeholder="Search tools…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tool list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-4 text-xs text-muted-foreground">
            No tools found.
          </p>
        ) : (
          filtered.map((tool) => (
            <div
              key={tool.id}
              className={cn(
                "relative flex items-center gap-2.5 h-12 px-4 text-sm border-b border-border",
                "text-sidebar-foreground/70 select-none",
                // TODO: make clickable / navigate when tool routing is implemented
              )}
            >
              <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{tool.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
