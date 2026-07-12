"use client";

/**
 * Menu detail header.
 * Shows the menu summary counts and description above the tabbed item views.
 */

import type { MenuDetail } from "@/lib/services/tools/menus";

export function MenuDetailHeader({
  menu,
}: {
  menu: MenuDetail;
  canManage: boolean;
}) {
  const itemCount = menu.itemsTotalCount ?? menu.items.length;

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Menu
          </p>
          <h1 className="mt-1 truncate text-2xl font-semibold">{menu.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {menu.description || "No description set."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium">
            {menu.tabs.length} tab{menu.tabs.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

    </section>
  );
}