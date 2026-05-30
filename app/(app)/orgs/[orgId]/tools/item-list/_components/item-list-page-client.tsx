"use client";

import { useRef, useState } from "react";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { ItemListSidebarContent } from "./item-list-sidebar-content";
import { ItemListClient, type ToolItem } from "./item-list-client";
import { ItemDetailPanel } from "./item-detail-panel";

interface ItemListPageClientProps {
  orgId: string;
  items: ToolItem[];
  canManage: boolean;
  view: "grid" | "list";
}

export function ItemListPageClient({
  orgId,
  items: initial,
  canManage,
  view,
}: ItemListPageClientProps) {
  const { open, close } = useActionSidebar();
  const keyRef = useRef(0);
  const [items, setItems] = useState<ToolItem[]>(initial);

  function openPanel(title: string, content: React.ReactNode) {
    const k = ++keyRef.current;
    open(title, <div key={k}>{content}</div>);
  }

  function handleCreate() {
    openPanel(
      "New Item",
      <ItemDetailPanel
        orgId={orgId}
        mode="create"
        canManage={canManage}
        onCreated={(item) => {
          setItems((prev) =>
            [...prev, item].sort((a, b) => a.name.localeCompare(b.name)),
          );
          close();
        }}
        onClose={close}
      />,
    );
  }

  function handleItemClick(item: ToolItem) {
    openPanel(
      item.name,
      <ItemDetailPanel
        orgId={orgId}
        mode="edit"
        item={item}
        canManage={canManage}
        onUpdated={(updated) => {
          setItems((prev) =>
            prev
              .map((i) => (i.id === updated.id ? updated : i))
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
          openPanel(
            updated.name,
            <ItemDetailPanel
              orgId={orgId}
              mode="edit"
              item={updated}
              canManage={canManage}
              onUpdated={(u) =>
                setItems((prev) =>
                  prev
                    .map((i) => (i.id === u.id ? u : i))
                    .sort((a, b) => a.name.localeCompare(b.name)),
                )
              }
              onDeleted={(id) => {
                setItems((prev) => prev.filter((i) => i.id !== id));
                close();
              }}
              onClose={close}
            />,
          );
        }}
        onDeleted={(id) => {
          setItems((prev) => prev.filter((i) => i.id !== id));
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
          <ItemListSidebarContent
            orgId={orgId}
            canManage={canManage}
            view={view}
            onCreateItem={handleCreate}
          />
        }
      />
      <ItemListClient
        orgId={orgId}
        items={items}
        view={view}
        canManage={canManage}
        onItemClick={handleItemClick}
        onCreateItem={handleCreate}
      />
    </>
  );
}
