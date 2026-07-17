"use client";

/**
 * Menu category manager panel.
 * Lets managers create, rename, delete, and reorder menu categories without
 * leaving the page sidebar.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import {
  createMenuTabAction,
  deleteMenuTabAction,
  moveMenuTabAction,
  reorderMenuTabsAction,
  updateMenuTabAction,
} from "@/app/actions/tools";
import {
  FilterCombobox,
  type FilterComboboxItem,
} from "@/components/ui/comboboxes/filter-combobox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { MenuCategoryReorderList } from "./menu-category-reorder-list";

type MenuTabDisplayMode = "CARDS" | "LIST";

export function AddMenuCategoryPanel({
  orgId,
  menuId,
  tabs,
  defaultParentTabId,
  onClose: _onClose,
}: {
  orgId: string;
  menuId: string;
  tabs: Array<{ id: string; name: string; description?: string | null; position: number; parentTabId?: string | null; displayMode?: MenuTabDisplayMode }>;
  defaultParentTabId?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [displayMode, setDisplayMode] = useState<MenuTabDisplayMode>("CARDS");
  const [parentTabId, setParentTabId] = useState<string | null>(defaultParentTabId ?? null);
  const [viewParentTabId, setViewParentTabId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [localTabs, setLocalTabs] = useState(() => [...tabs].sort((a, b) => a.position - b.position));
  const [isPending, startTransition] = useTransition();

  const visibleTabs = useMemo(
    () =>
      localTabs.filter((tab) => {
        if (viewParentTabId === null) return (tab.parentTabId ?? null) === null;
        return (tab.parentTabId ?? null) === viewParentTabId;
      }),
    [localTabs, viewParentTabId],
  );
  const selectedViewParentTab = useMemo(
    () => localTabs.find((tab) => tab.id === viewParentTabId) ?? null,
    [localTabs, viewParentTabId],
  );

  const parentCategoryItems = useMemo<FilterComboboxItem[]>(
    () =>
      localTabs
        .filter((tab) => (tab.parentTabId ?? null) === null)
        .map((tab) => ({ id: tab.id, name: tab.name })),
    [localTabs],
  );
  const viewCategoryItems = useMemo<FilterComboboxItem[]>(
    () => localTabs.map((tab) => ({ id: tab.id, name: tab.name })),
    [localTabs],
  );

  function handleViewParentChange(id: string | null) {
    setViewParentTabId(id);
  }

  function applySiblingOrder(
    currentTabs: typeof localTabs,
    parentId: string | null,
    orderedSiblingIds: string[],
  ) {
    const positionById = new Map(orderedSiblingIds.map((tabId, index) => [tabId, (index + 1) * 1000]));

    return currentTabs.map((tab) =>
      (tab.parentTabId ?? null) === parentId && positionById.has(tab.id)
        ? { ...tab, position: positionById.get(tab.id) ?? tab.position }
        : tab,
    );
  }

  function syncTabs(update: (currentTabs: typeof localTabs) => typeof localTabs) {
    setLocalTabs((currentTabs) => update(currentTabs));
    router.refresh();
  }

  function reorderTabs(nextOrder: typeof localTabs) {
    const ordered = nextOrder;
    setLocalTabs((currentTabs) =>
      applySiblingOrder(
        currentTabs,
        viewParentTabId ?? null,
        ordered.map((tab) => tab.id),
      ),
    );

    startTransition(async () => {
      const result = await reorderMenuTabsAction(
        orgId,
        menuId,
        ordered.map((tab) => tab.id),
        viewParentTabId,
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
    setParentTabId(tab?.parentTabId ?? null);
    setDisplayMode(tab?.displayMode ?? "CARDS");
  }

  function handleCancelEdit() {
    setEditingTabId(null);
    setName("");
    setDescription("");
    setDisplayMode("CARDS");
    setParentTabId(null);
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
          parentTabId,
          displayMode,
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
                  parentTabId,
                  displayMode,
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
        parentTabId,
        displayMode,
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
      setDisplayMode("CARDS");
      setParentTabId(null);
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
    const currentIndex = visibleTabs.findIndex((tab) => tab.id === tabId);
    if (currentIndex < 0) return;

    const adjacentIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (adjacentIndex < 0 || adjacentIndex >= visibleTabs.length) return;

    const nextOrder = [...visibleTabs];
    const [moved] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(adjacentIndex, 0, moved);
    setLocalTabs((currentTabs) =>
      applySiblingOrder(
        currentTabs,
        viewParentTabId ?? null,
        nextOrder.map((tab) => tab.id),
      ),
    );

    startTransition(async () => {
      const result = await moveMenuTabAction(orgId, menuId, tabId, direction, viewParentTabId);
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

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Parent category</span>
            <FilterCombobox
              items={parentCategoryItems}
              selectedId={parentTabId}
              allLabel="Top level"
              placeholder="Search categories…"
              searchable
              onSelect={setParentTabId}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Display mode</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  className="h-9 w-full justify-between rounded-full border-border/70 bg-background/85 px-3.5 shadow-sm"
                >
                  <span className="text-sm font-medium">
                    {displayMode === "CARDS" ? "Card" : "List"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-44">
                <DropdownMenuRadioGroup
                  value={displayMode}
                  onValueChange={(value) => setDisplayMode(value as MenuTabDisplayMode)}
                >
                  <DropdownMenuRadioItem value="CARDS">
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="font-medium">Card</span>
                      <span className="text-xs text-muted-foreground">Current image cards</span>
                    </div>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="LIST">
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="font-medium">List</span>
                      <span className="text-xs text-muted-foreground">Title-only rows</span>
                    </div>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Saving…" : editingTabId ? "Save category" : "Add category"}
          </Button>
        </div>
      </form>

      <Separator />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">View level</span>
        <FilterCombobox
          items={viewCategoryItems}
          selectedId={viewParentTabId}
          allLabel="Top level"
          placeholder="Search categories…"
          searchable
          onSelect={handleViewParentChange}
        />
      </div>

      <Separator />

      {selectedViewParentTab && (
        <div className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Viewing children of
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {selectedViewParentTab.name}
          </p>
          {selectedViewParentTab.description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {selectedViewParentTab.description}
            </p>
          ) : null}
        </div>
      )}

      <MenuCategoryReorderList
        tabs={visibleTabs}
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