"use client";

import { useRef, useTransition, useOptimistic, useState } from "react";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { RegisterPageSidebarTitle } from "@/components/layout/page-sidebar-context";
import { moveToolItemListEntryAction, addToolItemListEntryAtPositionAction } from "@/app/actions/tools";
import { ListGridView } from "./list-grid-view";
import { ListChecklistView } from "./list-checklist-view";
import { AddItemToListPanel, type PickableItem } from "./add-item-to-list-panel";
import { ItemDetailPanel } from "./item-detail-panel";
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
}: ListDetailClientProps) {
  const { open, close } = useActionSidebar();
  const keyRef = useRef(0);
  const [, startTransition] = useTransition();
  const [hiddenRateIds, setHiddenRateIds] = useState<Set<string>>(new Set());

  const showRates = activeSetRates.length > 0;

  // Optimistic entries — instantly reflects drags, reverts if action fails
  const [optimisticEntries, applyOptimistic] = useOptimistic(
    list.entries,
    (
      state,
      update: { from: number; to: number },
    ) =>
      state
        .map((e) => ({
          ...e,
          position:
            e.position === update.from
              ? update.to
              : e.position === update.to
                ? update.from
                : e.position,
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
        onClose={close}
      />,
    );
  }

  function handleSwap(fromPosition: number, toPosition: number) {
    startTransition(async () => {
      applyOptimistic({ from: fromPosition, to: toPosition });
      await moveToolItemListEntryAction(orgId, list.id, fromPosition, toPosition);
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

  function openItemDetailPanel(entry: { entryId: string; item: { id: string; name: string; unit: string }; position: number }) {
    const cols = list.gridConfig?.gridCols ?? 4;
    const rows = list.gridConfig?.gridRows ?? 4;
    const k = ++keyRef.current;
    open(
      entry.item.name,
      <ItemDetailPanel
        key={k}
        orgId={orgId}
        listId={list.id}
        entryId={entry.entryId}
        item={entry.item}
        position={entry.position}
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
        onClose={close}
      />,
    );
  }

  if (view === "checklist") {
    return (
      <>
        <RegisterPageSidebarTitle title={list.name} />
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
      <ListGridView
        orgId={orgId}
        listId={list.id}
        list={{ ...list, entries: optimisticEntries }}
        canManage={canManage}
        onCellClick={canManage ? openAddItemPanel : undefined}
        onSwap={canManage ? handleSwap : undefined}
        onDropNewItem={canManage ? handleDropNewItem : undefined}
        activeSetRates={activeSetRates}
        hiddenRateIds={hiddenRateIds}
        showRates={showRates}
        onItemClick={canManage || activeSetId ? openItemDetailPanel : undefined}
      />
    </>
  );
}
