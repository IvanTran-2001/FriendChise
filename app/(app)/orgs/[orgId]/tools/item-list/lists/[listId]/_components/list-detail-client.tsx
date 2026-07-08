"use client";

import { useRef, useTransition, useOptimistic, useState, useEffect } from "react";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { RegisterPageSidebarTitle, RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { moveToolItemListEntryByIdAction, addToolItemListEntryAtPositionAction } from "@/app/actions/tools";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMobileSidebar } from "@/components/layout/mobile-sidebar-context";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ListGridView } from "./list-grid-view";
import { ListChecklistView } from "./list-checklist-view";
import { AddItemToListPanel, type PickableItem } from "./add-item-to-list-panel";
import { ItemDetailPanel } from "./item-detail-panel";
import { ListDetailSidebarContent } from "./list-detail-sidebar-content";
import { PlacementStatusBanner } from "./placement-status-banner";
import type { ConversionRate } from "./item-rates-panel";

// Inferred from getToolItemListDetail return type
export type ListDetail = {
  id: string;
  name: string;
  description: string | null;
  displayType: "GRID" | "CHECKLIST" | "TABLE" | "GALLERY";
  gridConfig: { gridCols: number; gridRows: number } | null;
  entries: {
    id: string;
    position: number;
    amount: number;
    item: {
      id: string;
      name: string;
      unit: string;
      imgUrl: string | null;
      imageSignedUrl: string | null;
    };
    checklistEntry: {
      id: string;
      listEntryId: string;
      checkedAt: Date;
    } | null;
  }[];
};

interface ListDetailClientProps {
  orgId: string;
  list: ListDetail;
  view: "grid" | "checklist";
  canManage: boolean;
  activeSetId: string | null;
  activeSetName: string | null;
  activeSetRates: ConversionRate[];
  conversionSets: { id: string; name: string }[];
}

export function ListDetailClient({
  orgId,
  list,
  view,
  canManage,
  activeSetId,
  activeSetName,
  activeSetRates,
  conversionSets,
}: ListDetailClientProps) {
  const { open, close, activeTitle } = useActionSidebar();
  const keyRef = useRef(0);
  const [, startTransition] = useTransition();
  const [hiddenRateIds, setHiddenRateIds] = useState<Set<string>>(new Set());
  const [highlightedPos, setHighlightedPos] = useState<number | undefined>(undefined);
  const [currentView, setCurrentView] = useState(view);
  const [pendingItem, setPendingItem] = useState<PickableItem | null>(null);
  const [isPlacingItem, setIsPlacingItem] = useState(false);
  const [pendingDetailMove, setPendingDetailMove] = useState<{
    entryId: string;
    fromPosition: number;
    itemName: string;
  } | null>(null);
  const [isMovingItem, setIsMovingItem] = useState(false);
  const [addItemMode, setAddItemMode] = usePersistedState<"grid" | "manual">(
    `item-list-add-item-mode-${orgId}-${list.id}`,
    "grid",
  );
  const [, startPlacingTransition] = useTransition();
  const [, startMoveDetailTransition] = useTransition();
  const isMobile = useIsMobile();
  const { setOpen: setMobileSidebarOpen } = useMobileSidebar();

  // Clear highlight whenever the action sidebar is closed (X button or nav)
  useEffect(() => {
    if (activeTitle === null) setHighlightedPos(undefined);
  }, [activeTitle]);

  useEffect(() => {
    setCurrentView(view);
  }, [view]);

  function handleViewChange(nextView: "grid" | "checklist") {
    setCurrentView(nextView);
    const url = new URL(window.location.href);
    url.searchParams.set("view", nextView);
    window.history.replaceState(window.history.state, "", url.toString());
  }

  const showRates = activeSetRates.length > 0;

  // Optimistic entries — instantly reflects drags/moves in the UI; reverts on action failure
  const [optimisticEntries, applyOptimistic] = useOptimistic(
    list.entries,
    (
      state,
      update: { entryId: string; toPosition: number },
    ) =>
      state
        .map((e) => ({
          ...e,
          position: e.id === update.entryId ? update.toPosition : e.position,
        }))
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)),
  );

  function handleItemPicked(item: PickableItem) {
    setPendingItem(item);
    setPendingDetailMove(null);
    if (isMobile) close();
  }

  function cancelPendingDetailMove() {
    setPendingDetailMove(null);
    setIsMovingItem(false);
    setHighlightedPos(undefined);
  }

  function cancelPendingPlacement() {
    setPendingItem(null);
    setHighlightedPos(undefined);
    setIsPlacingItem(false);
    if (isMobile) {
      openAddItemPanel();
    }
  }

  function handlePlacementCellClick(position: number) {
    if (!pendingItem || isPlacingItem) return;
    const item = pendingItem;
    setHighlightedPos(position);
    setIsPlacingItem(true);
    startPlacingTransition(async () => {
      const { toast } = await import("sonner");
      const result = await addToolItemListEntryAtPositionAction(orgId, list.id, item.id, position);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to add item.");
        setIsPlacingItem(false);
        return;
      } else {
        toast.success(`"${item.name}" added.`);
      }
      setPendingItem(null);
      setIsPlacingItem(false);
      if (isMobile) openAddItemPanel();
    });
  }

  function armItemDetailMove(entryId: string, fromPosition: number, itemName: string) {
    setPendingItem(null);
    setPendingDetailMove({ entryId, fromPosition, itemName });
    setHighlightedPos(fromPosition);
  }

  function handleDetailMoveCellClick(position: number) {
    if (!pendingDetailMove || isMovingItem) return;
    if (pendingDetailMove.fromPosition === position) return;
    const { entryId, itemName } = pendingDetailMove;
    setHighlightedPos(position);
    setIsMovingItem(true);
    startMoveDetailTransition(async () => {
      const { toast } = await import("sonner");
      const result = await moveToolItemListEntryByIdAction(orgId, list.id, entryId, position);
      if (!result.ok) {
        toast.error("Failed to move item.");
        setIsMovingItem(false);
        return;
      }
      toast.success(`"${itemName}" moved.`);
      setIsMovingItem(false);
      setPendingDetailMove(null);
      close();
    });
  }

  function openAddItemPanel(targetPosition?: number) {
    setPendingItem(null);
    setPendingDetailMove(null);
    if (isMobile) setMobileSidebarOpen(false);
    const cols = list.gridConfig?.gridCols ?? 4;
    const rows = list.gridConfig?.gridRows ?? 4;
    const pageSize = cols * rows;
    let defaultPage = 1, defaultCol = 1, defaultRow = 1;
    if (targetPosition !== undefined) {
      defaultPage = Math.floor(targetPosition / pageSize) + 1;
      const posInPage = targetPosition % pageSize;
      defaultRow = Math.floor(posInPage / cols) + 1;
      defaultCol = (posInPage % cols) + 1;
    }
    setHighlightedPos(targetPosition);
    const k = ++keyRef.current;
    open(
      "Add Item",
      <AddItemToListPanel
        key={k}
        orgId={orgId}
        listId={list.id}
        defaultPage={defaultPage}
        defaultCol={defaultCol}
        defaultRow={defaultRow}
        gridCols={cols}
        gridRows={rows}
        onModeChange={setAddItemMode}
        onAdded={() => {}}
        onClose={() => { setHighlightedPos(undefined); close(); }}
        onPositionChange={(pos) => setHighlightedPos(pos)}
        onItemPicked={handleItemPicked}
      />,
    );
  }

  function handleMoveEntry(entryId: string, fromPosition: number, toPosition: number) {
    startTransition(async () => {
      applyOptimistic({ entryId, toPosition });
      const result = await moveToolItemListEntryByIdAction(orgId, list.id, entryId, toPosition);
      if (!result.ok) {
        const { toast } = await import("sonner");
        toast.error("Failed to move item.");
      }
    });
  }

  function handleDropNewItem(itemId: string, position: number) {
    startTransition(async () => {
      const result = await addToolItemListEntryAtPositionAction(orgId, list.id, itemId, position);
      if (!result.ok) {
        const { toast } = await import("sonner");
        toast.error("error" in result ? result.error : "Failed to add item.");
      }
    });
  }

  function openItemDetailPanel(entry: { entryId: string; item: { id: string; name: string; unit: string; imageSignedUrl: string | null }; position: number; subIndex: number; totalInCell: number }) {
    const k = ++keyRef.current;
    setHighlightedPos(entry.position);
    setPendingDetailMove(null);
    // Siblings at the same position, sorted oldest-first (by id, matching DB order)
    const siblings = optimisticEntries
      .filter((e) => e.position === entry.position)
      .sort((a, b) => a.id.localeCompare(b.id));
    open(
      entry.item.name,
      <ItemDetailPanel
        key={k}
        orgId={orgId}
        listId={list.id}
        entryId={entry.entryId}
        item={entry.item}
        amount={siblings.find((s) => s.id === entry.entryId)?.amount ?? 0}
        position={entry.position}
        subIndex={entry.subIndex}
        totalInCell={entry.totalInCell}
        gridCols={list.gridConfig?.gridCols ?? 4}
        gridRows={list.gridConfig?.gridRows ?? 4}
        canManage={!!canManage}
        rates={activeSetRates}
        setName={activeSetName}
        hiddenRateIds={hiddenRateIds}
        onSelectCell={() => armItemDetailMove(entry.entryId, entry.position, entry.item.name)}
        onToggleRate={(rateId) =>
          setHiddenRateIds((prev) => {
            const next = new Set(prev);
            if (next.has(rateId)) next.delete(rateId);
            else next.add(rateId);
            return next;
          })
        }
        onNavigate={(direction) => {
          const nextIdx = direction === "prev" ? entry.subIndex - 1 : entry.subIndex + 1;
          const sibling = siblings[nextIdx];
          if (!sibling) return;
          openItemDetailPanel({
            entryId: sibling.id,
            item: sibling.item,
            position: sibling.position,
            subIndex: nextIdx,
            totalInCell: siblings.length,
          });
        }}
        onClose={() => { cancelPendingDetailMove(); close(); }}
      />,
    );
  }

  const sidebarContent = (
    <ListDetailSidebarContent
      orgId={orgId}
      listId={list.id}
      view={currentView}
      canManage={canManage}
      gridCols={list.gridConfig?.gridCols}
      gridRows={list.gridConfig?.gridRows}
      conversionSets={conversionSets}
      activeSetId={activeSetId}
      onOpenAddItem={() => openAddItemPanel()}
      onViewChange={handleViewChange}
    />
  );

  if (currentView === "checklist") {
    return (
      <>
        <RegisterPageSidebarTitle title={list.name} />
        <RegisterPageSidebarSubContent content={sidebarContent} />
        <ListChecklistView
          orgId={orgId}
          list={{ ...list, entries: optimisticEntries }}
          canManage={canManage}
          activeSetRates={activeSetRates}
        />
      </>
    );
  }

  return (
    <>
      <RegisterPageSidebarTitle title={list.name} />
      <RegisterPageSidebarSubContent content={sidebarContent} />
      {pendingItem && (
        <PlacementStatusBanner
          title="Select a blue cell"
          itemName={pendingItem.name}
          message="Tap any blue cell to place the item."
          onCancel={cancelPendingPlacement}
        />
      )}
      {pendingDetailMove && (
        <PlacementStatusBanner
          title="Select a blue cell"
          itemName={pendingDetailMove.itemName}
          message="Tap any blue cell to place the item."
          onCancel={cancelPendingDetailMove}
        />
      )}
      <ListGridView
        orgId={orgId}
        listId={list.id}
        list={{ ...list, entries: optimisticEntries }}
        canManage={canManage}
        onCellClick={
          canManage
            ? (pendingItem
                ? handlePlacementCellClick
                : pendingDetailMove
                  ? handleDetailMoveCellClick
                  : activeTitle === "Add Item" && addItemMode === "manual"
                  ? openAddItemPanel
                  : undefined)
            : undefined
        }
        onMoveEntry={!pendingItem && canManage ? handleMoveEntry : undefined}
        onDropNewItem={!pendingItem && canManage ? handleDropNewItem : undefined}
        activeSetRates={activeSetRates}
        hiddenRateIds={hiddenRateIds}
        showRates={showRates}
        highlightedPosition={highlightedPos}
        placementMode={!!pendingItem || !!pendingDetailMove}
        onItemClick={
          pendingItem
            ? undefined
            : activeTitle === "Add Item"
              ? addItemMode === "manual"
                ? (entry) => openAddItemPanel(entry.position)
                : (entry) => openItemDetailPanel(entry)
              : canManage || activeSetId
                ? openItemDetailPanel
                : undefined
        }
        onSubIndexChange={!pendingItem && activeTitle !== null && activeTitle !== "Add Item" ? openItemDetailPanel : undefined}
      />
    </>
  );
}
