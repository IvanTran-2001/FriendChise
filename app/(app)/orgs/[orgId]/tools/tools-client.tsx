/**
 * ToolsClient — landing page content for `/orgs/[orgId]/tools`.
 *
 * Visual language matches the org home page (`app/(app)/orgs/[orgId]/page.tsx`):
 * calm `rounded-2xl border border-border/60 bg-card` section shells (no
 * baseline shadow), `rounded-xl border-border/60 bg-background` row items
 * for recent-activity lists, and `ring-1` icon wells for per-module color
 * identity. Module launch cards get a slightly stronger treatment (hover
 * lift + shadow) since they're the page's primary actions.
 *
 * Sections (recent first):
 *   1. **Recent work** — last activity across recent-activity-tracked
 *      categories, plus a Roster shortcut when the org has roster activity.
 *   2. **Favorites** — user-pinned tools (persisted per-org via localStorage).
 *   3. **All tools** — every tool in `TOOLS_CATALOG`.
 *
 * Tool metadata (icon/description/accent color) lives in `tools-catalog.ts`,
 * shared with `ToolsSidebarContent` so the grid and sidebar always agree.
 */
"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowLeftRight, ArrowRight, Clock, LayoutGrid, LayoutList, Star, Users } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useSupportsHover } from "@/hooks/use-hover-capability";
import { TOOLS_CATALOG, type ToolCatalogItem } from "./_components/tools-catalog";

interface RecentSet {
  id: string;
  name: string;
  updatedAt: Date;
  category: string;
  href: string;
}

interface ToolsClientProps {
  orgId: string;
  recentSets: RecentSet[];
  hasRoster: boolean;
}

type RecentItem = {
  key: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  eyebrow: string;
  title: string;
  meta?: string;
};

const RECENT_SET_TONES = [
  "bg-sky-500/10 text-sky-700 ring-sky-500/15 dark:text-sky-300",
  "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15 dark:text-emerald-300",
  "bg-violet-500/10 text-violet-700 ring-violet-500/15 dark:text-violet-300",
];

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="px-1">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ToolCard({
  tool,
  orgId,
  isFavorite,
  onToggleFavorite,
  supportsHover,
}: {
  tool: ToolCatalogItem;
  orgId: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  supportsHover: boolean;
}) {
  const Icon = tool.icon;
  return (
    <Link
      href={`/orgs/${orgId}/tools/${tool.id}`}
      className="group relative flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={cn(
          "absolute right-3 top-3 z-10 rounded-full p-1.5 transition-all duration-200",
          isFavorite
            ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/15"
            : cn(
                "text-muted-foreground/40 hover:bg-amber-500/5 hover:text-amber-500",
                supportsHover ? "opacity-0 group-hover:opacity-100" : "opacity-100",
              ),
        )}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
      </button>

      <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl ring-1", tool.accent)}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">{tool.name}</span>
        <span className="text-sm leading-6 text-muted-foreground">{tool.description}</span>
      </div>

      <div className="mt-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>Open module</span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export function ToolsClient({ orgId, recentSets, hasRoster }: ToolsClientProps) {
  const recent = recentSets.slice(0, 5);
  const showRecent = recent.length > 0 || hasRoster;
  const totalTools = TOOLS_CATALOG.length;
  const totalRecent = recent.length;

  const [favoriteIds, setFavoriteIds, hydrated] = usePersistedState<string[]>(
    `toolhub-favorites-${orgId}`,
    [],
  );
  const favoriteTools = hydrated ? TOOLS_CATALOG.filter((tool) => favoriteIds.includes(tool.id)) : [];
  const supportsHover = useSupportsHover();

  const toggleFavorite = (toolId: string) => {
    setFavoriteIds((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId],
    );
  };

  const recentItems: RecentItem[] = [];
  if (hasRoster) {
    recentItems.push({
      key: "roster",
      href: `/orgs/${orgId}/tools/roster`,
      icon: Users,
      tone: "bg-amber-500/10 text-amber-700 ring-amber-500/15 dark:text-amber-300",
      eyebrow: "Activity",
      title: "Roster",
    });
  }
  recent.forEach((set, index) => {
    const isItemList = set.category === "item-lists";
    recentItems.push({
      key: `${set.category}:${set.id}`,
      href: set.href,
      icon: isItemList ? LayoutList : ArrowLeftRight,
      tone: isItemList
        ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15 dark:text-emerald-300"
        : RECENT_SET_TONES[index % RECENT_SET_TONES.length],
      eyebrow: isItemList ? "Recent list" : "Recent set",
      title: set.name,
      meta: new Date(set.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6">
      <section className="rounded-2xl border border-border/60 bg-card px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tool Hub</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              Tooling that feels organized, not crowded.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Jump into recent work, open a module, or check roster activity without
              losing the thread.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:w-105 lg:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-background px-2.5 py-2.5 sm:px-4 sm:py-3">
              <div className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px] sm:tracking-[0.16em]">
                Tools
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl">{totalTools}</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background px-2.5 py-2.5 sm:px-4 sm:py-3">
              <div className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px] sm:tracking-[0.16em]">
                Recent activity
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl">{totalRecent}</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background px-2.5 py-2.5 sm:px-4 sm:py-3">
              <div className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px] sm:tracking-[0.16em]">
                Roster
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl">
                {hasRoster ? "On" : "Off"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {showRecent && (
        <section className="flex flex-col gap-3">
          <SectionHeader
            icon={Clock}
            title="Recent work"
            description="Fast access to the most recent work across the tools area."
          />

          <div className="flex flex-col gap-2">
            {recentItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl border border-border/60 bg-background p-3 transition-colors hover:border-primary/30"
                >
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1", item.tone)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {item.eyebrow}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-foreground">{item.title}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.meta && (
                      <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {item.meta}
                      </span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeader icon={Star} title="Favorites" description="Your pinned tools for quick access." />

        {favoriteTools.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {favoriteTools.map((tool) => (
              <ToolCard
                key={`fav-${tool.id}`}
                tool={tool}
                orgId={orgId}
                isFavorite
                onToggleFavorite={() => toggleFavorite(tool.id)}
                supportsHover={supportsHover}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <Star className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No favorite tools yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground/60">
              Click the star icon on any tool below to keep it at the top of your workspace.
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader
          icon={LayoutGrid}
          title="All tools"
          description="Open a module directly or use the sidebar to stay oriented."
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TOOLS_CATALOG.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              orgId={orgId}
              isFavorite={hydrated && favoriteIds.includes(tool.id)}
              onToggleFavorite={() => toggleFavorite(tool.id)}
              supportsHover={supportsHover}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
