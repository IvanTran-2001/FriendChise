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
import { ArrowLeftRight, List, Users, Calculator, Star, ClipboardList } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
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
    name: "Item List",
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
];

export function ToolsSidebarContent({ orgId }: { orgId: string }) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [favoriteIds, , hydrated] = usePersistedState<string[]>(
    `toolhub-favorites-${orgId}`,
    [],
  );

  const filtered = PLACEHOLDER_TOOLS.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

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
        {filtered.length === 0 ? (
          <p className="px-4 py-4 text-xs text-muted-foreground">
            No tools found.
          </p>
        ) : (
          filtered.map((tool) => {
            const href = `/orgs/${orgId}/tools/${tool.id}`;
            const isActive = pathname === href;
            const Icon = tool.icon;
            return (
              <Link
                key={tool.id}
                href={href}
                aria-current={isActive ? "page" : undefined}
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

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-medium text-sidebar-foreground">
                    <span className="truncate">{tool.name}</span>
                    {hydrated && favoriteIds.includes(tool.id) && (
                      <Star className="h-3.5 w-3.5 fill-current text-amber-500 shrink-0" />
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {tool.description}
                  </span>
                </span>

                <span
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                    isActive ? tool.activeBar : "bg-muted-foreground/20 group-hover:bg-muted-foreground/35",
                  )}
                />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
