"use client";

import { useRef, useTransition, useOptimistic, useState, useEffect } from "react";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { RegisterPageSidebarTitle, RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { moveToolItemListEntryByIdAction, addToolItemListEntryAtPositionAction } from "@/app/actions/tools";
import { ListGridView } from "./list-grid-view";
import { ListChecklistView } from "./list-checklist-view";
import { AddItemToListPanel, type PickableItem } from "./add-item-to-list-panel";
import { ItemDetailPanel } from "./item-detail-panel";
import { ListDetailSidebarContent } from "./list-detail-sidebar-content";
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
  allOrgItems: PickableItem[];
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
  allOrgItems,
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

  // Clear highlight whenever the action sidebar is closed (X button or nav)
  useEffect(() => {
    if (activeTitle === null) setHighlightedPos(undefined);
  }, [activeTitle]);

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
        .sort((a, b) => a.position - b.position),
  );

  function openAddItemPanel(targetPosition?: number) {
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
        availableItems={allOrgItems}
        defaultPage={defaultPage}
        defaultCol={defaultCol}
        defaultRow={defaultRow}
        gridCols={cols}
        gridRows={rows}
        onAdded={() => {}}
        onClose={() => { setHighlightedPos(undefined); close(); }}
        onPositionChange={(pos) => setHighlightedPos(pos)}
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
    const cols = list.gridConfig?.gridCols ?? 4;
    const rows = list.gridConfig?.gridRows ?? 4;
    const k = ++keyRef.current;
    setHighlightedPos(entry.position);
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
        position={entry.position}
        subIndex={entry.subIndex}
        totalInCell={entry.totalInCell}
        gridCols={cols}
        gridRows={rows}
        canManage={!!canManage}
        rates={activeSetRates}
        setName={activeSetName}
        hiddenRateIds={hiddenRateIds}
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
        onClose={() => { setHighlightedPos(undefined); close(); }}
      />,
    );
  }

  const sidebarContent = (
    <ListDetailSidebarContent
      orgId={orgId}
      listId={list.id}
      view={view}
      canManage={canManage}
      availableItems={allOrgItems}
      gridCols={list.gridConfig?.gridCols}
      gridRows={list.gridConfig?.gridRows}
      conversionSets={conversionSets}
      activeSetId={activeSetId}
      onOpenAddItem={() => openAddItemPanel()}
    />
  );

  if (view === "checklist") {
    return (
      <>
        <RegisterPageSidebarTitle title={list.name} />
        <RegisterPageSidebarSubContent content={sidebarContent} />
        <ListChecklistView
          orgId={orgId}
          list={{ ...list, entries: optimisticEntries }}
          canManage={canManage}
        />
      </>
    );
  }

  return (
    <>
      <RegisterPageSidebarTitle title={list.name} />
      <RegisterPageSidebarSubContent content={sidebarContent} />
      <ListGridView
        orgId={orgId}
        listId={list.id}
        list={{ ...list, entries: optimisticEntries }}
        canManage={canManage}
        onCellClick={canManage ? openAddItemPanel : undefined}
        onMoveEntry={canManage ? handleMoveEntry : undefined}
        onDropNewItem={canManage ? handleDropNewItem : undefined}
        activeSetRates={activeSetRates}
        hiddenRateIds={hiddenRateIds}
        showRates={showRates}
        highlightedPosition={highlightedPos}
        onItemClick={
          activeTitle === "Add Item"
            ? (entry) => openAddItemPanel(entry.position)
            : canManage || activeSetId
              ? openItemDetailPanel
              : undefined
        }
        onSubIndexChange={activeTitle !== null && activeTitle !== "Add Item" ? openItemDetailPanel : undefined}
      />
    </>
  );
}
