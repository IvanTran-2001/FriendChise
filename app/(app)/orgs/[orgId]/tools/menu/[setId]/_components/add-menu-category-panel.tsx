"use client";

/**
 * Menu category manager panel.
 * Lets managers create, rename, delete, and reorder menu categories without
 * leaving the page sidebar.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createMenuTabAction,
  deleteMenuTabAction,
  moveMenuTabAction,
  reorderMenuTabsAction,
  updateMenuTabAction,
} from "@/app/actions/tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { MenuCategoryReorderList } from "./menu-category-reorder-list";

export function AddMenuCategoryPanel({
  orgId,
  menuId,
  tabs,
  onClose: _onClose,
}: {
  orgId: string;
  menuId: string;
  tabs: Array<{ id: string; name: string; description?: string | null; position: number }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [localTabs, setLocalTabs] = useState(() => [...tabs].sort((a, b) => a.position - b.position));
  const [isPending, startTransition] = useTransition();

  const orderedTabs = useMemo(() => [...localTabs].sort((a, b) => a.position - b.position), [localTabs]);

  function normalizeTabs(nextOrder: typeof localTabs) {
    return nextOrder.map((tab, index) => ({
      ...tab,
      position: (index + 1) * 1000,
    }));
  }

  function syncTabs(update: (currentTabs: typeof localTabs) => typeof localTabs) {
    setLocalTabs((currentTabs) => {
      const nextTabs = normalizeTabs([...update(currentTabs)].sort((a, b) => a.position - b.position));
      return nextTabs;
    });
    router.refresh();
  }

  function reorderTabs(nextOrder: typeof localTabs) {
    const ordered = normalizeTabs([...nextOrder].sort((a, b) => a.position - b.position));
    setLocalTabs(ordered);

    startTransition(async () => {
      const result = await reorderMenuTabsAction(
        orgId,
        menuId,
        ordered.map((tab) => tab.id),
      );
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to reorder categories.");
        setLocalTabs([...tabs].sort((a, b) => a.position - b.position));
        return;
      }

      router.refresh();
    });
  }

  function handleEditTab(tabId: string) {
    const tab = localTabs.find((candidate) => candidate.id === tabId) ?? null;
    setEditingTabId(tabId);
    setName(tab?.name ?? "");
    setDescription(tab?.description ?? "");
  }

  function handleCancelEdit() {
    setEditingTabId(null);
    setName("");
    setDescription("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Category name is required.");
      return;
    }
    startTransition(async () => {
      if (editingTabId) {
        const result = await updateMenuTabAction(
          orgId,
          menuId,
          editingTabId,
          trimmedName,
          description.trim() || undefined,
        );
        if (!result.ok) {
          toast.error("error" in result ? result.error : "Failed to update category.");
          return;
        }

        syncTabs((currentTabs) =>
          currentTabs.map((tab) =>
            tab.id === editingTabId
              ? {
                  ...tab,
                  name: trimmedName,
                  description: description.trim() || null,
                }
              : tab,
          ),
        );
        toast.success(`"${trimmedName}" updated.`);
        handleCancelEdit();
        return;
      }

      const result = await createMenuTabAction(
        orgId,
        menuId,
        trimmedName,
        description.trim() || undefined,
      );
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to create category.");
        return;
      }

      const created = result.menuTab;
      syncTabs((currentTabs) => [...currentTabs, created]);
      toast.success(`"${trimmedName}" created.`);
      setName("");
      setDescription("");
    });
  }

  function handleDelete(tabId: string, tabName: string) {
    if (!window.confirm(`Delete category "${tabName}"?`)) return;

    startTransition(async () => {
      const result = await deleteMenuTabAction(orgId, menuId, tabId);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to delete category.");
        return;
      }

      syncTabs((currentTabs) => currentTabs.filter((tab) => tab.id !== tabId));
      if (editingTabId === tabId) {
        handleCancelEdit();
      }
      toast.success(`"${tabName}" deleted.`);
    });
  }

  function handleMoveTab(tabId: string, direction: "up" | "down") {
    const currentIndex = orderedTabs.findIndex((tab) => tab.id === tabId);
    if (currentIndex < 0) return;

    const adjacentIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (adjacentIndex < 0 || adjacentIndex >= orderedTabs.length) return;

    const nextOrder = [...orderedTabs];
    const [moved] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(adjacentIndex, 0, moved);
    const normalized = nextOrder.map((tab, index) => ({
      ...tab,
      position: (index + 1) * 1000,
    }));
    setLocalTabs(normalized);

    startTransition(async () => {
      const result = await moveMenuTabAction(orgId, menuId, tabId, direction);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to reorder category.");
        setLocalTabs([...tabs].sort((a, b) => a.position - b.position));
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border/70 bg-muted/20 p-3 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {editingTabId ? "Edit category" : "New category"}
            </p>
          </div>
          {editingTabId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancelEdit}
              disabled={isPending}
              className="shrink-0"
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="mt-3 space-y-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="menu-category-name" className="text-xs font-medium text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="menu-category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Breakfast"
              autoFocus
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="menu-category-description" className="text-xs font-medium text-muted-foreground">
              Description
            </label>
            <Input
              id="menu-category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              disabled={isPending}
            />
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Saving…" : editingTabId ? "Save category" : "Add category"}
          </Button>
        </div>
      </form>

      <Separator />

      <MenuCategoryReorderList
        tabs={localTabs}
        editingTabId={editingTabId}
        isPending={isPending}
        onEditTab={handleEditTab}
        onDeleteTab={handleDelete}
        onMoveTab={handleMoveTab}
        onReorderTabs={reorderTabs}
      />
    </div>
  );
}