/* eslint-disable @next/next/no-img-element */

import type { ResolvedMenuItem } from "./types";

/**
 * Kiosk-style menu item card.
 * Large image on top, price prominent, calorie info subtle.
 */
export function MenuItemCard({ item }: { item: ResolvedMenuItem }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-200 active:scale-[0.97]">
      {/* Image area — always fixed aspect ratio */}
      <div className="relative aspect-4/3 w-full overflow-hidden bg-stone-100">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-amber-50 to-stone-200">
            <span className="text-3xl opacity-40">🍽️</span>
          </div>
        )}

        {/* Price badge floating on image */}
        {item.price !== null && (
          <div className="absolute bottom-2 right-2 rounded-xl bg-stone-950/80 px-2.5 py-1 backdrop-blur-sm">
            <span className="text-sm font-bold text-amber-400">
              ${item.price.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-stone-900 sm:text-base">
          {item.title}
        </h3>

        {item.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-stone-500">
            {item.description}
          </p>
        ) : null}

        {/* Tags row */}
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1.5">
          {item.unit ? (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
              {item.unit}
            </span>
          ) : null}
          {item.calories !== null ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              {item.calories} cal
            </span>
          ) : null}
        </div>

        {item.notes ? (
          <p className="mt-1 rounded-lg bg-stone-50 px-2 py-1.5 text-[10px] italic leading-snug text-stone-400">
            {item.notes}
          </p>
        ) : null}
      </div>
    </article>
  );
}
