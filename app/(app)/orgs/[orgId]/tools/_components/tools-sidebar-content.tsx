/**
 * ToolsSidebarContent — page sidebar for `/orgs/[orgId]/tools`.
 *
 * Renders a searchable, favoritable list of tools as nav links. Each tool
 * navigates to its own sub-page at `/orgs/[orgId]/tools/<toolId>`.
 *
 * Row styling follows the same calm "page" nav pattern used by every other
 * page sidebar in the app (see `components/layout/sidebar/sidebar-nav-item.tsx`
 * — `rounded-md`, `before:` left accent bar for the active row, subtle
 * `hover:bg-sidebar-accent/60`) rather than the heavier bordered-card
 * treatment this file used previously. The per-tool accent color from
 * `TOOLS_CATALOG` is kept on the icon well only, since that's the fastest
 * way to recognize a module at a glance.
 *
 * Tool metadata lives in `tools-catalog.ts`, shared with `ToolsClient` (the
 * main Tool Hub grid) so the sidebar and grid never drift apart.
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star } from "lucide-react";
import { SearchInput } from "@/components/ui/controls/search-input";
import { cn } from "@/lib/core/utils";
import { useToolFavorites } from "@/hooks/use-tool-favorites";
import { useSupportsHover } from "@/hooks/use-hover-capability";
import { TOOLS_CATALOG, type ToolCatalogItem } from "./tools-catalog";

function ToolRow({
  tool,
  orgId,
  isActive,
  isFavorite,
  onToggleFavorite,
  supportsHover,
}: {
  tool: ToolCatalogItem;
  orgId: string;
  isActive: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  supportsHover: boolean;
}) {
  const Icon = tool.icon;
  return (
    <div className="group relative">
      <Link
        href={`/orgs/${orgId}/tools/${tool.id}`}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative mx-2 my-0.5 flex h-11 items-center gap-2.5 rounded-md py-1.5 pl-3 pr-9 text-[13px] font-medium transition-colors duration-150",
          "before:absolute before:left-1 before:top-1/2 before:h-5 before:w-0.75 before:-translate-y-1/2 before:rounded-full before:transition-colors",
          isActive
            ? "bg-sidebar-primary/10 text-primary font-semibold before:bg-primary"
            : "text-sidebar-foreground/80 before:bg-transparent hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1", tool.accent)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">{tool.name}</span>
      </Link>

      <button
        type="button"
        onClick={onToggleFavorite}
        className={cn(
          "absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full p-1 transition-all duration-200",
          isFavorite
            ? "text-amber-500 hover:bg-amber-500/10"
            : cn(
                "text-sidebar-foreground/30 hover:bg-amber-500/5 hover:text-amber-500",
                supportsHover
                  ? "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  : "opacity-100",
              ),
        )}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
      </button>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 px-3 pt-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
      {children}
    </p>
  );
}

export function ToolsSidebarContent({ orgId }: { orgId: string }) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const { favoriteIds, toggleFavorite, hydrated } = useToolFavorites(orgId);
  const supportsHover = useSupportsHover();

  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () => TOOLS_CATALOG.filter((tool) => tool.name.toLowerCase().includes(query)),
    [query],
  );
  const isSearching = query.length > 0;
  const favoriteTools = hydrated ? filtered.filter((tool) => favoriteIds.includes(tool.id)) : [];
  const remainingTools = hydrated ? filtered.filter((tool) => !favoriteIds.includes(tool.id)) : filtered;

  const renderRow = (tool: ToolCatalogItem) => {
    const href = `/orgs/${orgId}/tools/${tool.id}`;
    return (
      <ToolRow
        key={tool.id}
        tool={tool}
        orgId={orgId}
        isActive={pathname === href}
        isFavorite={hydrated && favoriteIds.includes(tool.id)}
        onToggleFavorite={() => toggleFavorite(tool.id)}
        supportsHover={supportsHover}
      />
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-3 py-2.5">
        <SearchInput
          placeholder="Search tools…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {filtered.length === 0 ? (
          <p className="px-4 py-4 text-xs text-muted-foreground">No tools found.</p>
        ) : (
          <>
            {favoriteTools.length > 0 && !isSearching && (
              <div>
                <GroupLabel>Favorites</GroupLabel>
                {favoriteTools.map(renderRow)}
              </div>
            )}
            <div>
              <GroupLabel>{favoriteTools.length > 0 && !isSearching ? "All tools" : "Tools"}</GroupLabel>
              {(isSearching ? filtered : remainingTools).map(renderRow)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
