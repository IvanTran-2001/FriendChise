"use client";

import { useRef, useState } from "react";
import { ListDisplayType } from "@prisma/client";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { ItemListsSidebarContent } from "./item-lists-sidebar-content";
import { ItemListsClient } from "./item-lists-client";
import { CreateListPanel } from "./create-list-panel";

type ToolItemList = {
  id: string;
  name: string;
  description: string | null;
  displayType: ListDisplayType;
  updatedAt: Date;
  _count: { entries: number };
};

interface ItemListsPageClientProps {
  orgId: string;
  lists: ToolItemList[];
  canManage: boolean;
  view: "list" | "card";
}

/**
 * Client wrapper that lifts `lists` state above both the sidebar and the main content
 * so creating a new list immediately updates the UI without a full page reload.
 * Previously the sidebar opened CreateListPanel independently and relied on router.refresh();
 * now it calls onCreateList() which appends the new list into shared state.
 */
export function ItemListsPageClient({
  orgId,
  lists: initial,
  canManage,
  view,
}: ItemListsPageClientProps) {
  const { open, close } = useActionSidebar();
  const keyRef = useRef(0);
  const [lists, setLists] = useState<ToolItemList[]>(initial);

  function handleCreate() {
    const k = ++keyRef.current;
    open(
      "New List",
      <CreateListPanel
        key={k}
        orgId={orgId}
        onCreated={(list) => {
          setLists((prev) =>
            [...prev, list].sort((a, b) => a.name.localeCompare(b.name)),
          );
          close();
        }}
        onClose={close}
      />,
    );
  }

  return (
    <>
      <RegisterPageSidebarSubContent
        content={
          <ItemListsSidebarContent
            orgId={orgId}
            canManage={canManage}
            view={view}
            onCreateList={handleCreate}
          />
        }
      />
      <ItemListsClient
        orgId={orgId}
        lists={lists}
        onListsChange={setLists}
        canManage={canManage}
        view={view}
      />
    </>
  );
}
