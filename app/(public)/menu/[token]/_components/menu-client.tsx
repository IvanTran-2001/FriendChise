"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ResolvedMenuData } from "./types";
import { MenuSection } from "./menu-section";

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
}: {
  data: ResolvedMenuData;
}) {
  const tabsByParentId = useMemo(() => {
    const children = new Map<string | null, (typeof data.tabs)[number][]>();
    for (const tab of data.tabs) {
      const parentId = tab.parentTabId ?? null;
      const current = children.get(parentId) ?? [];
      current.push(tab);
      children.set(parentId, current);
    }

    return children;
  }, [data]);

  const rootTabs = useMemo(() => tabsByParentId.get(null) ?? [], [tabsByParentId]);

  const allTabs = useMemo(
    () => [
      { id: ALL_ID, name: "ALL" },
      ...rootTabs.map((t) => ({ id: t.id, name: t.name })),
      ...(data.unassignedItems.length > 0
        ? [{ id: UNASSIGNED_ID, name: "Other" }]
        : []),
    ],
    [data.unassignedItems.length, rootTabs],
  );

  const [activeId, setActiveId] = useState<string>(ALL_ID);

  // Ref map: tab id → button element, for auto-scrolling the tab bar
  const tabButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // --- Intersection observer: track the section currently in view ----------
  useEffect(() => {
    if (allTabs.length <= 1) return;

    if (activeId === ALL_ID) return;

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

  const showUnassigned = activeId === ALL_ID || activeId === UNASSIGNED_ID;

  function renderTabTree(tab: (typeof data.tabs)[number], depth = 0): ReactNode {
    const children = tabsByParentId.get(tab.id) ?? [];

    return (
      <div key={tab.id} className="space-y-8">
        <MenuSection
          id={tab.id}
          name={tab.name}
          description={tab.description}
          items={tab.items}
          displayMode={tab.displayMode}
          depth={depth}
        />

        {children.length > 0 && (
          <div className="space-y-8">
            {children.map((child) => renderTabTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  function renderAllView() {
    return (
      <section id={ALL_ID} className="scroll-mt-33 space-y-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">
            All Items
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Browse every item in the menu, grouped by section.
          </p>
        </div>

        <div className="space-y-8">
          {rootTabs.map((tab) => renderTabTree(tab))}
        </div>

        {data.unassignedItems.length > 0 && (
          <MenuSection
            id={UNASSIGNED_ID}
            name="Other Items"
            items={data.unassignedItems}
          />
        )}
      </section>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
      <div className="mx-auto min-h-0 flex-1 w-full max-w-5xl space-y-10 overflow-y-auto px-4 pb-28 pt-6 sm:px-6 sm:pb-32 sm:pt-6">
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
            {data.tabs
              .filter((tab) => tab.id === activeId)
              .map((tab) => renderTabTree(tab))}

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
    </div>
  );
}
