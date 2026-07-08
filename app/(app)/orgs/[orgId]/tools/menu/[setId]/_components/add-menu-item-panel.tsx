"use client";

/**
 * Add/edit menu item panel.
 * Reuses the same form for creation and editing so the menu item fields stay
 * consistent when an item is created, updated, or prefilled from an existing row.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createMenuItemAction,
  createMenuTabAction,
  createToolItemAction,
  updateMenuItemAction,
} from "@/app/actions/tools";
import { getOrgStorageReadUrl } from "@/app/actions/storage";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { OrgImagePicker } from "@/components/ui/org-image-picker";
import type { MenuItemDetail, ToolItemOption } from "@/lib/services/tools/menus";

type MenuTabOption = {
  id: string;
  name: string;
};

export function AddMenuItemPanel({
  orgId,
  menuId,
  tabs,
  defaultTabId,
  initialItem,
  mode = "create",
  onClose,
}: {
  orgId: string;
  menuId: string;
  tabs: MenuTabOption[];
  defaultTabId: string | null;
  initialItem?: MenuItemDetail | null;
  mode?: "create" | "edit";
  onClose: () => void;
}) {
  const isEditMode = mode === "edit";
  const initialToolItem = initialItem
    ? {
        id: initialItem.toolItem.id,
        name: initialItem.toolItem.name,
        unit: initialItem.toolItem.unit,
        imgUrl: initialItem.toolItem.imgUrl,
      }
    : null;
  const initialImageUrl = isEditMode
    ? initialItem?.imageUrl ?? ""
    : initialItem?.imageUrl ?? initialToolItem?.imgUrl ?? "";

  const [selectedToolItem, setSelectedToolItem] = useState<ToolItemOption | null>(
    initialToolItem,
  );
  const [createNewToolItem, setCreateNewToolItem] = useState(false);
  const [newToolItemName, setNewToolItemName] = useState("");
  const [newToolItemUnit, setNewToolItemUnit] = useState("");
  const [selectedTabId, setSelectedTabId] = useState<string | null>(defaultTabId ?? null);
  const [localTabs, setLocalTabs] = useState<MenuTabOption[]>(tabs);
  const [title, setTitle] = useState(initialItem?.title ?? "");
  const [description, setDescription] = useState(initialItem?.description ?? "");
  const [price, setPrice] = useState(initialItem?.price?.toString() ?? "");
  const [calories, setCalories] = useState(initialItem?.calories?.toString() ?? "");
  const [notes, setNotes] = useState(initialItem?.notes ?? "");
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedTab = useMemo(
    () => localTabs.find((tab) => tab.id === selectedTabId) ?? null,
    [localTabs, selectedTabId],
  );

  useEffect(() => {
    setLocalTabs(tabs);
  }, [tabs]);

  function handleSelectCategory(tabId: string | null) {
    setSelectedTabId(tabId);
  }

  function handleCreateCategory(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    startTransition(async () => {
      const result = await createMenuTabAction(orgId, menuId, trimmedName);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to create category.");
        return;
      }

      setLocalTabs((current) =>
        current.some((tab) => tab.id === result.menuTab.id)
          ? current
          : [...current, { id: result.menuTab.id, name: result.menuTab.name }],
      );
      setSelectedTabId(result.menuTab.id);
      toast.success(`"${trimmedName}" category created.`);
    });
  }

  useEffect(() => {
    if (!imageUrl) return;

    let cancelled = false;

    void (async () => {
      const result = await getOrgStorageReadUrl(orgId, imageUrl);
      if (!cancelled) {
        setImagePreviewUrl(result.ok ? result.signedUrl : null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, orgId]);

  const loadToolItems = useMemo(
    () => async (search: string, page: number, signal: AbortSignal) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "24");
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(`/api/orgs/${orgId}/tools/item-list?${params.toString()}`, {
        signal,
      });
      if (!response.ok) {
        throw new Error("Failed to load tool items.");
      }

      const data = (await response.json()) as { items: ToolItemOption[]; totalPages: number };
      return { items: data.items, hasMore: page < data.totalPages };
    },
    [orgId],
  );

  function handleCreateToolItem(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSelectedToolItem(null);
    setCreateNewToolItem(true);
    setNewToolItemName(trimmedName);
    setNewToolItemUnit((current) => current || "each");
    setImageUrl("");
    setImagePreviewUrl(null);
  }

  function handleImageSelect(storagePath: string, signedUrl: string) {
    setImageUrl(storagePath);
    setImagePreviewUrl(signedUrl);
  }

  function parsePrice(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function parseCalories(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : undefined;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedTitle = title.trim();
    startTransition(async () => {
      let toolItemId = selectedToolItem?.id ?? null;
      const parsedPrice = parsePrice(price);
      if (parsedPrice === undefined) {
        toast.error("Price must be a valid number.");
        return;
      }

      const parsedCalories = parseCalories(calories);
      if (parsedCalories === undefined) {
        toast.error("Calories must be a whole number.");
        return;
      }

      if (!toolItemId) {
        const toolItemName = (newToolItemName.trim() || trimmedTitle).trim();
        const toolItemUnit = newToolItemUnit.trim();
        if (!toolItemName) {
          toast.error("Tool item name is required.");
          return;
        }
        if (!toolItemUnit) {
          toast.error("Tool item unit is required.");
          return;
        }

        const toolItemResult = await createToolItemAction(orgId, toolItemName, toolItemUnit);
        if (!toolItemResult.ok) {
          toast.error("error" in toolItemResult ? toolItemResult.error : "Failed to create tool item.");
          return;
        }
        toolItemId = toolItemResult.item.id;
      }

      const result = isEditMode && initialItem
        ? await updateMenuItemAction(
            orgId,
            menuId,
            initialItem.id,
            toolItemId,
            trimmedTitle,
            description.trim() || undefined,
            parsedPrice,
            parsedCalories,
            notes.trim() || undefined,
            selectedTabId,
            imageUrl.trim() || undefined,
          )
        : await createMenuItemAction(
            orgId,
            menuId,
            toolItemId,
            trimmedTitle,
            description.trim() || undefined,
            parsedPrice,
            parsedCalories,
            notes.trim() || undefined,
            selectedTabId,
            imageUrl.trim() || undefined,
          );
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to save item.");
        return;
      }
      toast.success(isEditMode ? `"${trimmedTitle}" updated.` : `"${trimmedTitle}" added.`);
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium">Image</label>
          {imageUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                setImageUrl("");
                setImagePreviewUrl(null);
              }}
              disabled={isPending}
            >
              Clear
            </Button>
          ) : null}
        </div>

        {imagePreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagePreviewUrl}
            alt="Menu item image"
            className="w-full max-h-48 rounded-lg object-cover border"
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            {isEditMode
              ? imageUrl
                ? "Loading menu item image…"
                : "No menu item image selected"
              : selectedToolItem?.imgUrl
                ? "Loading tool item image…"
                : "No image selected"}
          </div>
        )}

        <OrgImagePicker
          orgId={orgId}
          config={{ aspect: 1, outputWidth: 512, outputHeight: 512 }}
          disabled={isPending}
          onSelect={handleImageSelect}
          trigger={
            <Button type="button" variant="outline" size="sm" className="w-fit" disabled={isPending}>
              {imageUrl ? "Change image" : "Upload image"}
            </Button>
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Tool Item</label>
        <SearchableCombobox
          items={selectedToolItem ? [selectedToolItem] : []}
          loadItems={loadToolItems}
          triggerLabel={selectedToolItem ? selectedToolItem.name : "Select item"}
          placeholder="Search items…"
          emptyText="No tool items found"
          onCreate={handleCreateToolItem}
          onSelect={(item) => {
            const nextItem = item as ToolItemOption;
            setSelectedToolItem(nextItem);
            setCreateNewToolItem(false);
            setTitle(nextItem.name);
            setImageUrl(nextItem.imgUrl ?? "");
          }}
        />
      </div>

      {createNewToolItem && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-tool-item-name" className="text-sm font-medium">
              New Tool Item Name
            </label>
            <Input
              id="new-tool-item-name"
              value={newToolItemName}
              onChange={(e) => setNewToolItemName(e.target.value)}
              placeholder="e.g. Flour"
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-tool-item-unit" className="text-sm font-medium">
              New Tool Item Unit
            </label>
            <Input
              id="new-tool-item-unit"
              value={newToolItemUnit}
              onChange={(e) => setNewToolItemUnit(e.target.value)}
              placeholder="e.g. kg"
              disabled={isPending}
            />
          </div>
        </>
      )}

      <CollapsibleSection
        title="Item Info"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="menu-item-title" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="menu-item-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Menu item title"
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Category</label>
            <SearchableCombobox
              items={localTabs}
              triggerLabel={selectedTab ? selectedTab.name : "None"}
              placeholder="Search categories…"
              emptyText="No categories yet"
              onSelect={(tab) => handleSelectCategory(tab.id)}
              onCreateBlank={() => handleSelectCategory(null)}
              createBlankLabel="None"
              onCreate={handleCreateCategory}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="menu-item-description" className="text-sm font-medium">
              Description
            </label>
            <Input
              id="menu-item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              disabled={isPending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="menu-item-price" className="text-sm font-medium">
                Price
              </label>
              <Input
                id="menu-item-price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 12.50"
                type="number"
                step="0.01"
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="menu-item-calories" className="text-sm font-medium">
                Calories
              </label>
              <Input
                id="menu-item-calories"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="e.g. 420"
                type="number"
                step="1"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="menu-item-notes" className="text-sm font-medium">
              Notes
            </label>
            <Input
              id="menu-item-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              disabled={isPending}
            />
          </div>
        </div>
      </CollapsibleSection>

      <Button type="submit" disabled={isPending || !title.trim()} className="w-full">
        {isPending ? "Saving…" : isEditMode ? "Save Changes" : "Add Item"}
      </Button>
    </form>
  );
}