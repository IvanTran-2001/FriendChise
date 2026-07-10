"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResolvedMenuData, ResolvedMenuItem } from "./types";
import { MenuSection } from "./menu-section";
import { MenuItemCard } from "./menu-item-card";

const UNASSIGNED_ID = "__unassigned__";
const ALL_ID = "__all__";

/**
 * Main client component for the public menu viewer.
 *
 * Responsibilities:
 * - Renders a sticky horizontally-scrollable category tab bar.
 * - Tracks which section is in the viewport via IntersectionObserver and
 *   highlights the matching tab.
 * - Clicking a tab smoothly scrolls to the corresponding section.
 * - Auto-centres the active tab pill within the tab bar.
 */
export function MenuClient({
  data,
  publicToken,
}: {
  data: ResolvedMenuData;
  publicToken: string;
}) {
  const pageSize = 24;
  const allTabs = useMemo(
    () => [
      { id: ALL_ID, name: "ALL" },
      ...data.tabs.map((t) => ({ id: t.id, name: t.name })),
      ...(data.unassignedItems.length > 0
        ? [{ id: UNASSIGNED_ID, name: "Other" }]
        : []),
    ],
    [data.tabs, data.unassignedItems.length],
  );

  const [activeId, setActiveId] = useState<string>(ALL_ID);
  const [allItems, setAllItems] = useState<ResolvedMenuItem[]>([]);
  const [allPage, setAllPage] = useState(0);
  const [allHasMore, setAllHasMore] = useState(true);
  const [allLoading, setAllLoading] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);

  // Ref map: tab id → button element, for auto-scrolling the tab bar
  const tabButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const allSentinelRef = useRef<HTMLDivElement | null>(null);

  const loadNextAllPage = useCallback(async () => {
    if (allLoading || !allHasMore) return;
    setAllLoading(true);
    setAllError(null);
    try {
      const nextPage = allPage + 1;
      const response = await fetch(
        `/api/menu/${encodeURIComponent(publicToken)}/items?page=${nextPage}&pageSize=${pageSize}`,
      );
      if (!response.ok) {
        throw new Error("Failed to load more menu items.");
      }

      const payload = (await response.json()) as {
        items: ResolvedMenuItem[];
        page: number;
        totalPages: number;
        hasMore: boolean;
      };

      setAllItems((prev) => [...prev, ...payload.items]);
      setAllPage(payload.page);
      setAllHasMore(payload.hasMore);
    } catch {
      setAllError("Failed to load items. Please try again.");
    } finally {
      setAllLoading(false);
    }
  }, [allHasMore, allLoading, allPage, pageSize, publicToken]);

  useEffect(() => {
    if (activeId !== ALL_ID || allItems.length > 0 || allLoading) return;
    void loadNextAllPage();
  }, [activeId, allItems.length, allLoading, loadNextAllPage]);

  // --- Intersection observer: track the section currently in view ----------
  useEffect(() => {
    if (activeId === ALL_ID || allTabs.length <= 1) return;

    const mountedIds =
      activeId === UNASSIGNED_ID
        ? [UNASSIGNED_ID]
        : [activeId];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      // rootMargin accounts for the sticky header (64px) + tabs bar (~56px)
      { rootMargin: "-130px 0px -55% 0px", threshold: 0 },
    );

    for (const tabId of mountedIds) {
      const el = document.getElementById(tabId);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [allTabs, activeId]);

  // --- Auto-centre the active tab pill in the tab bar ----------------------
  useEffect(() => {
    const btn = tabButtonRefs.current.get(activeId);
    btn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeId]);

  function handleTabClick(id: string) {
    setActiveId(id);
    if (id === ALL_ID) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const section = document.getElementById(id);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // If there are no tabs and no items at all, show a friendly empty state
  const isEmpty = data.tabs.length === 0 && data.unassignedItems.length === 0;

  const visibleTabs =
    activeId === ALL_ID
      ? data.tabs
      : activeId === UNASSIGNED_ID
        ? []
        : data.tabs.filter((tab) => tab.id === activeId);

  const showUnassigned = activeId === ALL_ID || activeId === UNASSIGNED_ID;

  useEffect(() => {
    if (activeId !== ALL_ID || !allHasMore || allLoading || allItems.length === 0) return;

    const sentinel = allSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadNextAllPage();
      }
    });

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [activeId, allHasMore, allItems.length, allLoading, loadNextAllPage]);

  function renderAllView() {
    return (
      <section id={ALL_ID} className="scroll-mt-33 space-y-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">
            All Items
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Browse every item in the menu.
          </p>
        </div>

        {allItems.length === 0 && allLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-2xl bg-stone-200" />
            ))}
          </div>
        ) : allItems.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {allItems.map((item) => (
                <MenuItemCard key={item.id} item={item} />
              ))}
            </div>

            <div ref={allSentinelRef} className="flex min-h-10 items-center justify-center py-2">
              {allLoading ? (
                <p className="text-xs text-stone-400">Loading more items…</p>
              ) : allError ? (
                <p className="text-xs text-red-500">{allError}</p>
              ) : allHasMore ? (
                <p className="text-xs text-stone-400">Scroll for more</p>
              ) : (
                <p className="text-xs text-stone-400">You&apos;ve reached the end</p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <span className="text-5xl">🍽️</span>
            <p className="text-lg font-semibold text-stone-600">No items yet</p>
            <p className="text-sm text-stone-400">Check back soon!</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      {/* ── Sticky tab bar ─────────────────────────────────────────────────── */}
      {allTabs.length > 1 && (
        <div className="sticky top-16 z-20 border-b border-stone-200 bg-white shadow-sm">
          <div
            className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2.5 sm:px-6 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            {allTabs.map((tab) => {
              const isActive = tab.id === activeId;
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    if (el) tabButtonRefs.current.set(tab.id, el);
                    else tabButtonRefs.current.delete(tab.id);
                  }}
                  onClick={() => handleTabClick(tab.id)}
                  type="button"
                  className={[
                    "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150",
                    isActive
                      ? "bg-amber-400 text-stone-950 shadow-sm"
                      : "text-stone-600 hover:bg-stone-100 active:bg-stone-200",
                  ].join(" ")}
                >
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sections ───────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl space-y-10 px-4 pb-28 pt-6 sm:px-6 sm:pb-32">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <span className="text-5xl">🍽️</span>
            <p className="text-lg font-semibold text-stone-600">No items yet</p>
            <p className="text-sm text-stone-400">Check back soon!</p>
          </div>
        ) : activeId === ALL_ID ? (
          renderAllView()
        ) : (
          <>
            {visibleTabs.map((tab) => (
              <MenuSection
                key={tab.id}
                id={tab.id}
                name={tab.name}
                description={tab.description}
                items={tab.items}
              />
            ))}

            {showUnassigned && data.unassignedItems.length > 0 && (
              <MenuSection
                id={UNASSIGNED_ID}
                name="Other Items"
                items={data.unassignedItems}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
