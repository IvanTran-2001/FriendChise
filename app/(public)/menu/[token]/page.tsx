import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getPublicMenuDetail, recordMenuPreviewDailyView } from "@/lib/services/tools";
import { createSignedReadUrls, getPublicUrl } from "@/lib/supabase-storage";
import { MenuNavbar } from "./_components/menu-navbar";
import { MenuClient } from "./_components/menu-client";
import type { ResolvedMenuData, ResolvedMenuItem, ResolvedMenuTab } from "./_components/types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

const loadPublicMenu = cache(async (token: string): Promise<ResolvedMenuData | null> => {
  const menu = await getPublicMenuDetail(token);
  if (!menu) return null;

  try {
    await recordMenuPreviewDailyView(menu.id);
  } catch (error) {
    console.error("Failed to record public menu preview view:", error);
  }

  // Menu item images are stored in the private bucket, so they all need signed URLs.
  const privatePaths = new Set<string>();
  for (const item of menu.items) {
    const p = item.imageUrl ?? item.toolItem.imgUrl;
    if (p) privatePaths.add(p);
  }
  for (const tab of menu.tabs) {
    for (const pl of tab.placements) {
      const p = pl.menuItem.imageUrl ?? pl.menuItem.toolItem.imgUrl;
      if (p) privatePaths.add(p);
    }
  }

  const signedUrls = await createSignedReadUrls([...privatePaths]);

  function resolveUrl(path: string | null): string | null {
    if (!path) return null;
    return signedUrls.get(path) ?? null;
  }

  function mapItem(item: NonNullable<typeof menu>["items"][number]): ResolvedMenuItem {
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      price: item.price,
      calories: item.calories,
      notes: item.notes,
      imageUrl: resolveUrl(item.imageUrl ?? item.toolItem.imgUrl),
      unit: item.toolItem.unit,
    };
  }

  // Build resolved tabs
  const tabbedItemIds = new Set<string>();
  const tabs: ResolvedMenuTab[] = menu.tabs.map((tab) => ({
    id: tab.id,
    parentTabId: tab.parentTabId,
    position: tab.position,
    displayMode: tab.displayMode,
    name: tab.name,
    description: tab.description,
    items: tab.placements.map((pl) => {
      tabbedItemIds.add(pl.menuItem.id);
      return {
        id: pl.menuItem.id,
        title: pl.menuItem.title,
        description: pl.menuItem.description,
        price: pl.priceOverride ?? pl.menuItem.price,
        calories: pl.menuItem.calories,
        notes: pl.menuItem.notes,
        imageUrl: resolveUrl(pl.menuItem.imageUrl ?? pl.menuItem.toolItem.imgUrl),
        unit: pl.menuItem.toolItem.unit,
      };
    }),
  }));

  return {
    name: menu.name,
    description: menu.description,
    orgName: menu.org.name,
    orgLogoUrl: menu.org.image ? getPublicUrl(menu.org.image) : null,
    tabs,
    unassignedItems: menu.items
      .filter((item) => !tabbedItemIds.has(item.id))
      .map(mapItem),
  };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const data = await loadPublicMenu(token);
  if (!data) return { title: "Menu not found | FriendChise" };
  return {
    title: `${data.name} | ${data.orgName}`,
    description: data.description ?? `Browse the menu at ${data.orgName}.`,
  };
}

export default async function PublicMenuPage({ params }: PageProps) {
  const { token } = await params;
  const data = await loadPublicMenu(token);
  if (!data) notFound();

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-stone-100">
      <MenuNavbar
        orgName={data.orgName}
        orgLogoUrl={data.orgLogoUrl}
        menuName={data.name}
      />
      <MenuClient data={data} />

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/90 px-4 py-3 text-center backdrop-blur-md sm:px-6">
        <p className="text-xs text-stone-500">
          Powered by <span className="font-semibold text-stone-700">FriendChise</span>
        </p>
      </footer>
    </div>
  );
}
