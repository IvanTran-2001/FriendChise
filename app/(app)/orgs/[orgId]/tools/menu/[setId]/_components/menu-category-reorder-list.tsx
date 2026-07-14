"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { GripVertical, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type MenuCategoryTab = {
  id: string;
  name: string;
  description?: string | null;
  position: number;
  parentTabId?: string | null;
};

type ReorderTarget = {
  tabId: string;
  insertBefore: boolean;
};

export function MenuCategoryReorderList({
  tabs,
  editingTabId,
  isPending,
  onEditTab,
  onDeleteTab,
  onMoveTab,
  onReorderTabs,
}: {
  tabs: MenuCategoryTab[];
  editingTabId: string | null;
  isPending: boolean;
  onEditTab: (tabId: string) => void;
  onDeleteTab: (tabId: string, tabName: string) => void;
  onMoveTab: (tabId: string, direction: "up" | "down") => void;
  onReorderTabs: (nextOrder: MenuCategoryTab[]) => void;
}) {
  const [draftTabs, setDraftTabs] = useState<MenuCategoryTab[] | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const draftTabsRef = useRef<MenuCategoryTab[] | null>(null);
  const tabCardRefs = useRef(new Map<string, HTMLDivElement>());
  const previousRectsRef = useRef(new Map<string, DOMRect>());
  const activePointerIdRef = useRef<number | null>(null);
  const lastPointerYRef = useRef<number | null>(null);

  const orderedTabs = useMemo(
    () => [...(draftTabs ?? tabs)].sort((a, b) => a.position - b.position),
    [draftTabs, tabs],
  );

  const tabById = useMemo(() => new Map(orderedTabs.map((tab) => [tab.id, tab])), [orderedTabs]);

  const depthByTabId = useMemo(() => {
    const cache = new Map<string, number>();

    function resolveDepth(tabId: string): number {
      const cached = cache.get(tabId);
      if (cached !== undefined) return cached;

      const tab = tabById.get(tabId);
      const depth = tab?.parentTabId ? resolveDepth(tab.parentTabId) + 1 : 0;
      cache.set(tabId, depth);
      return depth;
    }

    for (const tab of orderedTabs) {
      resolveDepth(tab.id);
    }

    return cache;
  }, [orderedTabs, tabById]);

  const normalizeTabs = useCallback((nextOrder: MenuCategoryTab[]) => {
    return nextOrder.map((tab, index) => ({
      ...tab,
      position: (index + 1) * 1000,
    }));
  }, []);

  const moveDraggedTab = useCallback(
    (target: ReorderTarget, draggedTabId: string) => {
      if (draggedTabId === target.tabId) return;

      setDraftTabs((currentTabs) => {
        const sourceTabs = currentTabs ?? tabs;
        const currentOrder = [...sourceTabs].sort((a, b) => a.position - b.position);
        const fromIndex = currentOrder.findIndex((tab) => tab.id === draggedTabId);
        const targetIndex = currentOrder.findIndex((tab) => tab.id === target.tabId);
        if (fromIndex < 0 || targetIndex < 0) return sourceTabs;

        const nextOrder = [...currentOrder];
        const [moved] = nextOrder.splice(fromIndex, 1);
        const targetIndexAfterRemoval = nextOrder.findIndex((tab) => tab.id === target.tabId);
        nextOrder.splice(targetIndexAfterRemoval + (target.insertBefore ? 0 : 1), 0, moved);

        const normalized = normalizeTabs(nextOrder);
        previousRectsRef.current = new Map(
          [...tabCardRefs.current.entries()].map(([tabId, element]) => [tabId, element.getBoundingClientRect()]),
        );
        draftTabsRef.current = normalized;
        return normalized;
      });
    },
    [normalizeTabs, tabs],
  );

  useEffect(() => {
    if (draggedTabId) return;

    const nextRects = new Map<string, DOMRect>();
    const animations: Animation[] = [];

    for (const [tabId, element] of tabCardRefs.current.entries()) {
      const previousRect = previousRectsRef.current.get(tabId);
      const nextRect = element.getBoundingClientRect();
      nextRects.set(tabId, nextRect);

      if (!previousRect) continue;

      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;
      if (deltaX === 0 && deltaY === 0) continue;

      animations.push(
        element.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: "translate(0px, 0px)" },
          ],
          {
            duration: 90,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        ),
      );
    }

    previousRectsRef.current = nextRects;

    return () => {
      for (const animation of animations) {
        animation.cancel();
      }
    };
  }, [draggedTabId, orderedTabs]);

  function clearDragState() {
    setDraggedTabId(null);
    activePointerIdRef.current = null;
    lastPointerYRef.current = null;
    setDraftTabs(null);
    draftTabsRef.current = null;
  }

  function handleDragPointerDown(event: ReactPointerEvent<HTMLButtonElement>, tabId: string) {
    event.preventDefault();
    const nextTabs = [...tabs].sort((a, b) => a.position - b.position);
    setDraftTabs(nextTabs);
    draftTabsRef.current = nextTabs;
    setDraggedTabId(tabId);
    activePointerIdRef.current = event.pointerId;
    lastPointerYRef.current = event.clientY;
  }

  useEffect(() => {
    if (!draggedTabId) return;
    const activeDraggedTabId = draggedTabId;

    function handlePointerMove(event: PointerEvent) {
      if (activePointerIdRef.current !== event.pointerId) return;

      const movingDown = lastPointerYRef.current === null ? true : event.clientY > lastPointerYRef.current;
      lastPointerYRef.current = event.clientY;

      const currentOrder = draftTabsRef.current ?? tabs;
      const draggedIndex = currentOrder.findIndex((tab) => tab.id === draggedTabId);
      if (draggedIndex < 0) return;

      if (movingDown) {
        const nextTab = currentOrder[draggedIndex + 1];
        const nextElement = nextTab ? tabCardRefs.current.get(nextTab.id) : null;
        if (!nextTab || !nextElement) return;

        const nextRect = nextElement.getBoundingClientRect();
        const threshold = nextRect.top + nextRect.height * 0.1;
        if (event.clientY >= threshold) {
          moveDraggedTab({ tabId: nextTab.id, insertBefore: false }, activeDraggedTabId);
        }
        return;
      }

      const previousTab = currentOrder[draggedIndex - 1];
      const previousElement = previousTab ? tabCardRefs.current.get(previousTab.id) : null;
      if (!previousTab || !previousElement) return;

      const previousRect = previousElement.getBoundingClientRect();
      const threshold = previousRect.bottom - previousRect.height * 0.1;
      if (event.clientY <= threshold) {
        moveDraggedTab({ tabId: previousTab.id, insertBefore: true }, activeDraggedTabId);
      }
    }

    function handlePointerUp(event: PointerEvent) {
      if (activePointerIdRef.current !== event.pointerId) return;

      onReorderTabs(draftTabsRef.current ?? tabs);
      clearDragState();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [draggedTabId, moveDraggedTab, onReorderTabs, tabs]);

  return (
    <div className="space-y-2">
      {orderedTabs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-3 py-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No categories yet.</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Create the first category above. It will appear here and can be reordered later.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {orderedTabs.map((tab) => {
            const isEditingThisTab = editingTabId === tab.id;
            const depth = depthByTabId.get(tab.id) ?? 0;
            const parentName = tab.parentTabId ? tabById.get(tab.parentTabId)?.name ?? null : null;

            return (
              <div
                key={tab.id}
                data-tab-id={tab.id}
                ref={(element) => {
                  if (element) {
                    tabCardRefs.current.set(tab.id, element);
                  } else {
                    tabCardRefs.current.delete(tab.id);
                  }
                }}
                className={[
                  "flex flex-col gap-2 rounded-2xl border px-3 py-3 transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out",
                  isEditingThisTab
                    ? "border-primary/30 bg-primary/5 shadow-sm"
                    : "border-border/70 bg-background/80 hover:border-primary/30 hover:bg-muted/20",
                  draggedTabId === tab.id ? "ring-2 ring-primary/40 shadow-md" : "",
                ].join(" ")}
                style={{ marginLeft: `${depth * 12}px` }}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    aria-label={`Move ${tab.name}`}
                    onPointerDown={(event) => handleDragPointerDown(event, tab.id)}
                    className="mt-0.5 shrink-0 cursor-grab touch-none rounded-md p-1 text-muted-foreground/45 transition-colors hover:bg-muted/40 hover:text-muted-foreground active:cursor-grabbing active:bg-muted/60"
                    disabled={isPending}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <div className="relative min-w-0 flex-1 pr-8">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-7 w-7 rounded-full"
                          disabled={isPending}
                          aria-label={`Open actions for ${tab.name}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-40">
                        <DropdownMenuItem onSelect={() => onEditTab(tab.id)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => onMoveTab(tab.id, "up")}
                          disabled={isPending || orderedTabs[0]?.id === tab.id}
                        >
                          Move up
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => onMoveTab(tab.id, "down")}
                          disabled={isPending || orderedTabs[orderedTabs.length - 1]?.id === tab.id}
                        >
                          Move down
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => onDeleteTab(tab.id, tab.name)}
                          disabled={isPending}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex items-start gap-0.5">
                      <p className="min-w-0 flex-1 text-[12px] font-semibold leading-3 wrap-break-word pr-1">
                        {tab.name}
                      </p>
                    </div>
                    {parentName ? (
                      <p className="mt-px text-[10px] leading-3 text-muted-foreground/70">
                        Parent: {parentName}
                      </p>
                    ) : null}
                    {tab.description ? (
                      <p className="mt-px line-clamp-2 text-[10px] leading-3 text-muted-foreground">
                        {tab.description}
                      </p>
                    ) : (
                      <p className="mt-px text-[10px] leading-3 text-muted-foreground/60">No description</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}