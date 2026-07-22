/**
 * ToolsSidebarContent — page sidebar for `/orgs/[orgId]/tools`.
 *
 * Renders a searchable list of available tools as nav links. Each tool
 * navigates to its own sub-page at `/orgs/[orgId]/tools/<toolId>`.
 *
 * `PLACEHOLDER_TOOLS` is a static list — swap for a DB-driven query once a
 * `Tool` model exists in the schema.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { ArrowLeftRight, List, Users, Calculator, Star, ClipboardList, FileScan } from "lucide-react";
import { SearchInput } from "@/components/ui/controls/search-input";
import { cn } from "@/lib/core/utils";
import { usePersistedState } from "@/hooks/use-persisted-state";

// Placeholder tool list — replace with DB-driven data once the Tool model exists
type ToolItem = {
  id: string;
  name: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  accent: string;
  iconTone: string;
  activeBar: string;
};

const PLACEHOLDER_TOOLS: ToolItem[] = [
  {
    id: "item-list",
    name: "Items",
    icon: List,
    description: "Catalogs and inventory",
    accent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    iconTone: "ring-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    activeBar: "bg-emerald-500",
  },
  {
    id: "conversion",
    name: "Conversion",
    icon: ArrowLeftRight,
    description: "Transform quantities",
    accent: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    iconTone: "ring-sky-500/15 text-sky-700 dark:text-sky-300",
    activeBar: "bg-sky-500",
  },
  {
    id: "menu",
    name: "Menu",
    icon: ClipboardList,
    description: "Customer-facing menu layouts",
    accent: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    iconTone: "ring-rose-500/15 text-rose-700 dark:text-rose-300",
    activeBar: "bg-rose-500",
  },
  {
    id: "roster",
    name: "Roster",
    icon: Users,
    description: "Team schedules and shifts",
    accent: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    iconTone: "ring-amber-500/15 text-amber-700 dark:text-amber-300",
    activeBar: "bg-amber-500",
  },
  {
    id: "calculator",
    name: "Calculator",
    icon: Calculator,
    description: "Quick arithmetic calculations",
    accent: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    iconTone: "ring-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    activeBar: "bg-indigo-500",
  },
  {
    id: "scan-to-task",
    name: "Scan to Task",
    icon: FileScan,
    description: "Pictures and PDFs into tasks",
    accent: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    iconTone: "ring-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    activeBar: "bg-cyan-500",
  },
];

export function ToolsSidebarContent({ orgId }: { orgId: string }) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [favoriteIds, setFavoriteIds, hydrated] = usePersistedState<string[]>(
    `toolhub-favorites-${orgId}`,
    [],
  );

  function filterContent() {
    return PLACEHOLDER_TOOLS.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  }

  const sortedTools = [...filterContent()].sort((a, b) => {
    const aFavorite = favoriteIds.includes(a.id);
    const bFavorite = favoriteIds.includes(b.id);

    return Number(bFavorite) - Number(aFavorite);
  });

    const toggleFavorite = (toolId: string) => {
    setFavoriteIds((prev) => {
      const isFav = prev.includes(toolId);
      if (isFav) {
        return prev.filter((id) => id !== toolId);
      } else {
        return [...prev, toolId];
      }
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 border-b border-border px-3 py-2.5">
        <SearchInput
          placeholder="Search tools…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sortedTools.length === 0 ? (
          <p className="px-4 py-4 text-xs text-muted-foreground">
            No tools found.
          </p>
        ) : (
          sortedTools.map((tool) => {
            const href = `/orgs/${orgId}/tools/${tool.id}`;
            const isActive = pathname === href;
            const isFavorite = hydrated && favoriteIds.includes(tool.id);
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                className={cn(
                  "group relative mx-2 my-1 flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-3 text-[13px] transition-all duration-150",
                  isActive
                    ? "border-sidebar-border/70 bg-sidebar-primary/10 shadow-sm"
                    : "border-border bg-card/70 hover:border-primary/25 hover:bg-card hover:shadow-sm",
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-0 h-full w-1.5 rounded-r-full transition-opacity",
                    isActive ? tool.activeBar : "bg-transparent opacity-0 group-hover:opacity-100",
                  )}
                />

                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className="group/link flex min-w-0 flex-1 items-center gap-3"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ring-1 transition-all duration-150",
                      tool.accent,
                      isActive
                        ? `${tool.iconTone} shadow-sm`
                        : `${tool.iconTone} bg-background/70 shadow-sm group-hover:-translate-y-0.5`,
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>

                  <span className="min-w-0 flex-1 truncate font-medium text-sidebar-foreground">
                    {tool.name}
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => toggleFavorite(tool.id)}
                  className={cn(
                    "z-10 rounded-full p-1.5 transition-all duration-200",
                    isFavorite
                      ? "text-amber-500 bg-amber-500/5 hover:bg-amber-500/10"
                      : "text-muted-foreground/40 opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-amber-500 hover:bg-amber-500/5",
                  )}
                  aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
                </button>

                <span
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                    isActive ? tool.activeBar : "bg-muted-foreground/20 group-hover:bg-muted-foreground/35",
                  )}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
