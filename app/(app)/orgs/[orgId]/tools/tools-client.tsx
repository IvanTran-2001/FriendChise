/**
 * ToolsClient — landing page content for `/orgs/[orgId]/tools`.
 *
 * Two sections (recent first):
 *   1. **Recent** — last 5 ConversionSets by `updatedAt`, with a "View all" link.
 *      Hidden when the org has no sets yet.
 *   2. **Tools** — shortcut cards for each tool (Item List, Conversion, Roster)
 *      linking to their respective sub-pages.
 *
 * `TOOLS` is a static list mirroring `PLACEHOLDER_TOOLS` in `tools-sidebar-content.tsx`.
 * Both should be updated together when new tools are added.
 */
"use client";

import Link from "next/link";
import { ArrowLeftRight, ArrowRight, LayoutList, List, Users } from "lucide-react";

const TOOLS = [
  {
    id: "item-list",
    name: "Item List",
    icon: List,
    description: "Manage your ingredient and product catalog",
    accent: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15 dark:text-emerald-300",
  },
  {
    id: "conversion",
    name: "Conversion",
    icon: ArrowLeftRight,
    description: "Convert quantities between items",
    accent: "bg-sky-500/10 text-sky-700 ring-sky-500/15 dark:text-sky-300",
  },
  {
    id: "roster",
    name: "Roster",
    icon: Users,
    description: "Manage team rosters and schedules",
    accent: "bg-amber-500/10 text-amber-700 ring-amber-500/15 dark:text-amber-300",
  },
];

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

export function ToolsClient({
  orgId,
  recentSets,
  hasRoster,
}: ToolsClientProps) {
  const recent = recentSets.slice(0, 5);
  const showRecent = recent.length > 0 || hasRoster;
  const totalTools = TOOLS.length;
  const totalRecent = recent.length;

  return (
    <>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6">
        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:mt-3 sm:text-4xl">
                Tooling that feels organized, not crowded.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:mt-3 sm:text-base">
                Jump into recent work, open a module, or check roster activity without
                losing the thread.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 lg:w-105 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background px-2.5 py-2.5 shadow-sm sm:px-4 sm:py-3">
                <div className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px] sm:tracking-[0.16em]">
                  Tools
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl">{totalTools}</div>
              </div>
              <div className="rounded-2xl border border-border bg-background px-2.5 py-2.5 shadow-sm sm:px-4 sm:py-3">
                <div className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px] sm:tracking-[0.16em]">
                  Recent sets
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl">{totalRecent}</div>
              </div>
              <div className="rounded-2xl border border-border bg-background px-2.5 py-2.5 shadow-sm sm:px-4 sm:py-3">
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
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Recent work
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fast access to the most recent work across the tools area.
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
              {hasRoster && (
                <Link
                  href={`/orgs/${orgId}/tools/roster`}
                  className="group relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-amber-500/70" />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/15 dark:text-amber-300">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Activity
                          </p>
                          <h3 className="mt-1 text-base font-semibold sm:text-lg">Roster</h3>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Manage team rosters, schedules, and activity in a dedicated workspace.
                      </p>
                    </div>
                  </div>
                </Link>
              )}

              <div className="grid gap-3">
                {recent.length > 0 ? (
                  recent.map((set, index) => (
                    <Link
                      key={`${set.category}:${set.id}`}
                      href={set.href}
                      className="group relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                    >
                      <div
                        className={`absolute inset-x-0 top-0 h-1 ${
                          index === 0
                            ? "bg-sky-500/70"
                            : index === 1
                              ? "bg-emerald-500/70"
                              : "bg-violet-500/70"
                        }`}
                      />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${
                            set.category === "item-lists"
                              ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15 dark:text-emerald-300"
                              : index === 0
                              ? "bg-sky-500/10 text-sky-700 ring-sky-500/15 dark:text-sky-300"
                              : index === 1
                                ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15 dark:text-emerald-300"
                                : "bg-violet-500/10 text-violet-700 ring-violet-500/15 dark:text-violet-300"
                          }`}
                        >
                          {set.category === "item-lists" ? (
                            <LayoutList className="h-5 w-5" />
                          ) : (
                            <ArrowLeftRight className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                {set.category === "item-lists" ? "Recent list" : "Recent set"}
                              </p>
                              <h3 className="mt-1 truncate text-sm font-semibold sm:text-base">
                                {set.name}
                              </h3>
                            </div>
                            <span className="shrink-0 rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                              {new Date(set.updatedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <div className="mt-2 inline-flex rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            {set.category === "item-lists" ? "Item List" : "Conversion"}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </Link>
                  ))
                ) : null}
              </div>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <div className="px-1">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Tools
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open a module directly or use the sidebar to stay oriented.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.id}
                  href={`/orgs/${orgId}/tools/${tool.id}`}
                  className="group relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <div
                    className={`absolute inset-x-0 top-0 h-1 ${
                      tool.id === "item-list"
                        ? "bg-emerald-500/70"
                        : tool.id === "conversion"
                          ? "bg-sky-500/70"
                          : "bg-amber-500/70"
                    }`}
                  />
                  <div className="flex h-full flex-col gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${tool.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      <div>
                        <span className="text-sm font-semibold">{tool.name}</span>
                        <span className="block mt-1 text-sm leading-6 text-muted-foreground">
                          {tool.description}
                        </span>
                      </div>
                      <div className="mt-auto flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span>Open module</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
