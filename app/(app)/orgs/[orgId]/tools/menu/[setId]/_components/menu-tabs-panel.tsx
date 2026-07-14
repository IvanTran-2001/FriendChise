"use client";

/**
 * Menu tabs panel.
 * Displays each menu tab and its placements so the page can show the current
 * ordering and the items assigned to every category.
 */

import type { MenuDetail } from "@/lib/services/tools/menus";

export function MenuTabsPanel({
  menu,
}: {
  orgId: string;
  menu: MenuDetail;
  canManage: boolean;
}) {
  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Tabs
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tab order follows the menu position, and each placement keeps its own index.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {menu.tabs.map((tab) => (
          <article key={tab.id} className="rounded-2xl border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Position {tab.position + 1}
                </p>
                <h3 className="mt-1 text-base font-semibold">{tab.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tab.description || "No tab description."}
                </p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {tab.placements.length} placement{tab.placements.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-4 grid gap-2">
              {tab.placements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items in this tab yet.</p>
              ) : (
                tab.placements.map((placement) => (
                  <div
                    key={placement.id}
                    className="flex items-center justify-between rounded-xl border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{placement.menuItem.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {placement.menuItem.toolItem.name} · {placement.menuItem.toolItem.unit}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                      {placement.position}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}