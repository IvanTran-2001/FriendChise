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

type MenuItemDraft = {
  title: string;
  description: string;
  price: string;
  calories: string;
  notes: string;
  imageUrl: string;
  selectedTabAssignments: { tabId: string; priceOverride: string }[];
};

export function AddMenuItemPanel({
  orgId,
  menuId,
  menuItems,
  itemDefaultTabAssignments,
  tabs,
  defaultTabId,
  defaultTabAssignments,
  initialItem,
  prefill,
  mode = "create",
  onClose,
  onSwitchToEdit,
}: {
  orgId: string;
  menuId: string;
  menuItems: MenuItemDetail[];
  itemDefaultTabAssignments: Map<string, { tabId: string; priceOverride: number | null }[]>;
  tabs: MenuTabOption[];
  defaultTabId: string | null;
  defaultTabAssignments?: { tabId: string; priceOverride: number | null }[];
  initialItem?: MenuItemDetail | null;
  prefill?: MenuItemDraft | null;
  mode?: "create" | "edit";
  onClose: () => void;
  onSwitchToEdit?: (item: MenuItemDetail, draft: MenuItemDraft) => void;
}) {
  const pickPrefill = (draftValue: string | undefined, fallbackValue: string) =>
    draftValue && draftValue.trim() ? draftValue : fallbackValue;

  const initialToolItem = initialItem
    ? {
        id: initialItem.toolItem.id,
        name: initialItem.toolItem.name,
        unit: initialItem.toolItem.unit,
        imgUrl: initialItem.toolItem.imgUrl,
      }
    : null;
  const initialImageUrl =
    prefill?.imageUrl && prefill.imageUrl.trim()
      ? prefill.imageUrl
      : mode === "edit"
        ? initialItem?.imageUrl ?? initialToolItem?.imgUrl ?? ""
        : initialItem?.imageUrl ?? initialToolItem?.imgUrl ?? "";

  const [editingItem, setEditingItem] = useState<MenuItemDetail | null>(initialItem ?? null);
  const isEditMode = mode === "edit" || editingItem !== null;

  const [selectedToolItem, setSelectedToolItem] = useState<ToolItemOption | null>(
    initialToolItem,
  );
  const [localTabs, setLocalTabs] = useState<MenuTabOption[]>(tabs);
  const [title, setTitle] = useState(
    pickPrefill(prefill?.title, initialItem?.title ?? ""),
  );
  const [description, setDescription] = useState(
    pickPrefill(prefill?.description, initialItem?.description ?? ""),
  );
  const [price, setPrice] = useState(
    pickPrefill(prefill?.price, initialItem?.price?.toString() ?? ""),
  );
  const [calories, setCalories] = useState(
    pickPrefill(prefill?.calories, initialItem?.calories?.toString() ?? ""),
  );
  const [notes, setNotes] = useState(
    pickPrefill(prefill?.notes, initialItem?.notes ?? ""),
  );
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [selectedTabAssignments, setSelectedTabAssignments] = useState<
    { tabId: string; priceOverride: string }[]
  >(() =>
    prefill?.selectedTabAssignments?.length
      ? prefill.selectedTabAssignments
      : initialItem
      ? (defaultTabAssignments ?? []).map((assignment) => ({
          tabId: assignment.tabId,
          priceOverride:
            assignment.priceOverride === null ? "" : String(assignment.priceOverride),
        }))
      : defaultTabId
        ? [{ tabId: defaultTabId, priceOverride: "" }]
        : [],
  );
  const [isPending, startTransition] = useTransition();

  const selectedTabs = useMemo(
    () =>
      selectedTabAssignments
        .map((assignment) => localTabs.find((tab) => tab.id === assignment.tabId))
        .filter((tab): tab is MenuTabOption => !!tab),
    [localTabs, selectedTabAssignments],
  );

  const availableTabs = useMemo(
    () => localTabs.filter((tab) => !selectedTabAssignments.some((assignment) => assignment.tabId === tab.id)),
    [localTabs, selectedTabAssignments],
  );

  useEffect(() => {
    setLocalTabs(tabs);
  }, [tabs]);

  function maybeApplySelectedToolImage(nextImageUrl: string | null) {
    if (!nextImageUrl) return;

    if (!imageUrl) {
      setImageUrl(nextImageUrl);
      setImagePreviewUrl(null);
      return;
    }

    if (imageUrl === nextImageUrl) return;

    const shouldReplace = window.confirm(
      "Replace the current image with this item's image?",
    );

    if (shouldReplace) {
      setImageUrl(nextImageUrl);
      setImagePreviewUrl(null);
    }
  }

  function selectToolItem(item: ToolItemOption) {
    if (mode !== "create") return;

    const existingItem = menuItems.find((menuItem) => menuItem.toolItemId === item.id);
    if (!existingItem) {
      setSelectedToolItem(item);
      setTitle((current) => (current.trim() ? current : item.name));
      maybeApplySelectedToolImage(item.imgUrl);
      return;
    }

    const existingAssignments = itemDefaultTabAssignments.get(existingItem.id) ?? [];
    const nextAssignments = new Map<string, string>();

    for (const assignment of existingAssignments) {
      nextAssignments.set(
        assignment.tabId,
        assignment.priceOverride === null ? "" : String(assignment.priceOverride),
      );
    }

    for (const assignment of selectedTabAssignments) {
      if (!nextAssignments.has(assignment.tabId)) {
        nextAssignments.set(assignment.tabId, assignment.priceOverride);
      }
    }

    const draft: MenuItemDraft = {
      title: title,
      description,
      price,
      calories,
      notes,
      imageUrl,
      selectedTabAssignments: [...nextAssignments.entries()].map(([tabId, priceOverride]) => ({
        tabId,
        priceOverride,
      })),
    };

    if (onSwitchToEdit) {
      onSwitchToEdit(existingItem, draft);
      return;
    }

    setSelectedToolItem(item);
    maybeApplySelectedToolImage(item.imgUrl);
    setEditingItem(existingItem);
    setTitle((current) => (current.trim() ? current : existingItem.title));
    setDescription((current) => (current.trim() ? current : (existingItem.description ?? "")));
    setPrice((current) => (current.trim() ? current : (existingItem.price === null ? "" : String(existingItem.price))));
    setCalories((current) => (current.trim() ? current : (existingItem.calories === null ? "" : String(existingItem.calories))));
    setNotes((current) => (current.trim() ? current : (existingItem.notes ?? "")));
    setImageUrl((current) => (current.trim() ? current : (existingItem.imageUrl ?? existingItem.toolItem.imgUrl ?? "")));
    setSelectedTabAssignments([...nextAssignments.entries()].map(([tabId, priceOverride]) => ({ tabId, priceOverride })));
  }

  function handleSelectCategory(tabId: string | null) {
    if (!tabId) return;
    setSelectedTabAssignments((current) =>
      current.some((assignment) => assignment.tabId === tabId)
        ? current
        : [...current, { tabId, priceOverride: "" }],
    );
  }

  function handleRemoveCategory(tabId: string) {
    setSelectedTabAssignments((current) => current.filter((assignment) => assignment.tabId !== tabId));
  }

  function handleCategoryPriceChange(tabId: string, value: string) {
    setSelectedTabAssignments((current) =>
      current.map((assignment) =>
        assignment.tabId === tabId ? { ...assignment, priceOverride: value } : assignment,
      ),
    );
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
      setSelectedTabAssignments((current) =>
        current.some((assignment) => assignment.tabId === result.menuTab.id)
          ? current
          : [...current, { tabId: result.menuTab.id, priceOverride: "" }],
      );
      toast.success(`"${trimmedName}" category created.`);
    });
  }

  useEffect(() => {
    if (mode !== "edit" || !initialItem) return;
    setEditingItem(initialItem);
  }, [initialItem, mode]);

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

    startTransition(async () => {
      const result = await createToolItemAction(orgId, trimmedName, "");
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to create tool item.");
        return;
      }

      setSelectedToolItem({
        ...result.item,
        imgUrl: null,
      });
      setTitle((current) => (current.trim() ? current : trimmedName));
      toast.success(`"${trimmedName}" created.`);
    });
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
      const toolItemId = selectedToolItem?.id;
      if (!toolItemId) {
        toast.error("Choose or create a tool item first.");
        return;
      }

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

      const effectiveTitle = trimmedTitle || selectedToolItem?.name || "";
      if (!effectiveTitle) {
        toast.error("Title is required.");
        return;
      }

      const effectiveImageUrl = imageUrl.trim() || undefined;
      const tabAssignments = selectedTabAssignments.map((assignment) => ({
        tabId: assignment.tabId,
        priceOverride:
          assignment.priceOverride.trim() === "" ? null : Number(assignment.priceOverride),
      }));

      if (tabAssignments.some((assignment) => assignment.priceOverride !== null && !Number.isFinite(assignment.priceOverride))) {
        toast.error("Each category price must be a valid number.");
        return;
      }

      const result = editingItem
        ? await updateMenuItemAction(
            orgId,
            menuId,
        editingItem.id,
            toolItemId,
            effectiveTitle,
            description.trim() || undefined,
            parsedPrice,
            parsedCalories,
            notes.trim() || undefined,
            tabAssignments,
            effectiveImageUrl,
          )
        : await createMenuItemAction(
            orgId,
            menuId,
            toolItemId,
            effectiveTitle,
            description.trim() || undefined,
            parsedPrice,
            parsedCalories,
            notes.trim() || undefined,
            tabAssignments,
            effectiveImageUrl,
          );
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to save item.");
        return;
      }
      toast.success(isEditMode ? `"${effectiveTitle}" updated.` : `"${effectiveTitle}" added.`);
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Tool item
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Search an existing item, or create one from the search text.
            </p>
          </div>
          {selectedToolItem ? (
            <span className="shrink-0 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {isEditMode ? "Editing" : "Selected"}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            Tool Item <span className="text-destructive">*</span>
          </label>
          <SearchableCombobox
            items={selectedToolItem ? [selectedToolItem] : []}
            loadItems={loadToolItems}
            triggerLabel={selectedToolItem ? selectedToolItem.name : "Select item"}
            placeholder="Search items…"
            emptyText="No tool items found"
            onCreate={handleCreateToolItem}
            onSelect={(item) => {
              const nextItem = item as ToolItemOption;
              selectToolItem(nextItem);
            }}
          />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-medium text-muted-foreground">Image</label>
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

            {selectedTabs.length > 0 ? (
              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
                  Active in
                </span>
                {selectedTabs.map((tab) => (
                  <span key={tab.id} className="rounded-full border border-border/70 bg-background px-2 py-0.5">
                    {tab.name}
                  </span>
                ))}
              </div>
            ) : null}

          {imagePreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreviewUrl}
              alt="Menu item image"
              className="h-44 w-full rounded-xl border object-cover"
            />
          ) : (
            <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/70 text-center text-sm text-muted-foreground">
              {isEditMode
                ? imageUrl
                  ? "Loading menu item image…"
                  : "No menu item image selected"
                : imageUrl
                  ? "Loading menu item image…"
                  : "No image selected"}
            </div>
          )}

          <OrgImagePicker
            orgId={orgId}
            config={{ aspect: 1, outputWidth: 512, outputHeight: 512 }}
            disabled={isPending}
            onSelect={handleImageSelect}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit rounded-full"
                disabled={isPending}
              >
                {imageUrl ? "Change image" : "Upload image"}
              </Button>
            }
          />
        </div>
      </div>

      <CollapsibleSection title="Item Info">
        <div className="flex flex-col gap-4 rounded-2xl bg-background/80">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="menu-item-title" className="text-xs font-medium text-muted-foreground">
              Title <span className="text-destructive">*</span>
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
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <div className="flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-background/70 p-2">
              {selectedTabs.length === 0 ? (
                <span className="px-2 py-1 text-xs text-muted-foreground">No categories selected</span>
              ) : (
                selectedTabs.map((tab) => (
                  <div key={tab.id} className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-2 py-1 text-xs font-medium text-foreground">
                    <span className="whitespace-nowrap">{tab.name}</span>
                    <Input
                      value={selectedTabAssignments.find((assignment) => assignment.tabId === tab.id)?.priceOverride ?? ""}
                      onChange={(event) => handleCategoryPriceChange(tab.id, event.target.value)}
                      placeholder="Price"
                      type="number"
                      step="0.01"
                      className="h-7 w-20 rounded-full border-border/70 bg-background/90 px-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(tab.id)}
                      className="rounded-full px-1 text-muted-foreground transition-colors hover:text-destructive"
                      title="Remove category"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
            <SearchableCombobox
              items={availableTabs}
              triggerLabel={selectedTabs.length > 0 ? `Add category (${selectedTabs.length})` : "Add category"}
              placeholder="Search categories…"
              emptyText="No categories yet"
              onSelect={(tab) => handleSelectCategory(tab.id)}
              onCreate={handleCreateCategory}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="menu-item-description" className="text-xs font-medium text-muted-foreground">
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
              <label htmlFor="menu-item-price" className="text-xs font-medium text-muted-foreground">
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
              <label htmlFor="menu-item-calories" className="text-xs font-medium text-muted-foreground">
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
            <label htmlFor="menu-item-notes" className="text-xs font-medium text-muted-foreground">
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

      <Button type="submit" disabled={isPending} className="w-full rounded-full">
        {isPending ? "Saving…" : isEditMode ? "Save changes" : "Add item"}
      </Button>
    </form>
  );
}