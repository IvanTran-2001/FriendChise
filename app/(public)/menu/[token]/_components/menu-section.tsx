import type { ResolvedMenuItem } from "./types";
import { MenuItemCard } from "./menu-item-card";

/**
 * One category section (e.g. "Burgers", "Drinks").
 * The `id` is used as the anchor target for scroll-spy and tab navigation.
 * Extra top scroll margin keeps the section heading from hiding behind the
 * sticky navbar and category bar on scroll.
 */
export function MenuSection({
  id,
  name,
  description,
  items,
  displayMode = "CARDS",
  depth = 0,
  forceShow = false,
  showEmptyState = true,
}: {
  id: string;
  name: string;
  description?: string | null;
  items: ResolvedMenuItem[];
  displayMode?: "CARDS" | "LIST";
  depth?: number;
  forceShow?: boolean;
  showEmptyState?: boolean;
}) {
  if (items.length === 0 && !forceShow) return null;

  return (
    <section id={id} className="scroll-mt-33" style={{ marginLeft: `${depth * 10}px` }}>
      {/* Section heading */}
      <div className="mb-4">
        <h2 className="text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">
          {name}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-stone-500">{description}</p>
        ) : null}
      </div>

      {items.length === 0 ? (
        showEmptyState ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-8 text-sm text-stone-400">
            No items in this section yet.
          </div>
        ) : null
      ) : displayMode === "LIST" ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex min-h-22 flex-col rounded-2xl border border-stone-200 bg-white px-2.5 py-2 shadow-sm"
            >
              <div className="flex items-start justify-between gap-1">
                <h3 className="min-w-0 flex-1 truncate text-sm font-bold leading-tight text-stone-900">
                  {item.title}
                </h3>
                {item.price !== null ? (
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700 leading-none">
                    ${item.price.toFixed(2)}
                  </span>
                ) : null}
              </div>

              {item.description ? (
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-stone-500">
                  {item.description}
                </p>
              ) : null}

              {item.notes || item.unit || item.calories !== null ? (
                <div className="mt-auto pt-1 text-[11px] leading-tight text-stone-400">
                  <span className="line-clamp-1">
                    {[item.unit, item.calories !== null ? `${item.calories} cal` : null, item.notes]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        /* Responsive grid — 2 cols on mobile, 3 on tablet, 4 on desktop */
        <div className="grid grid-cols-2 justify-items-center gap-3 sm:grid-cols-3 sm:justify-items-stretch lg:grid-cols-4">
          {items.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
