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
}: {
  id: string;
  name: string;
  description?: string | null;
  items: ResolvedMenuItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section id={id} className="scroll-mt-33">
      {/* Section heading */}
      <div className="mb-4">
        <h2 className="text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">
          {name}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-stone-500">{description}</p>
        ) : null}
      </div>

      {/* Responsive grid — 2 cols on mobile, 3 on tablet, 4 on desktop */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <MenuItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
