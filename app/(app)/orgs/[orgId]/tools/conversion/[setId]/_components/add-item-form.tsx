/**
 * AddItemForm — action sidebar panel for managing org-scoped ToolItems.
 *
 * Two sections:
 *   1. **Create form** — name + unit inputs; on submit, adds the item to the DB
 *      and appends it to the local list.
 *   2. **Item list** — searchable list of existing items. Clicking a row opens
 *      `EditItemForm` in the same sidebar panel with a back button.
 *
 * `itemsRef` is a mutable ref kept in sync with `items` state. It is updated
 * synchronously (before `setItems`) so that `onBack()` — which fires in the
 * same tick — always reads the latest list rather than a stale closure value.
 */
"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import {
  createToolItemAction,
  updateToolItemAction,
  deleteToolItemAction,
} from "@/app/actions/tools";

type ToolItem = { id: string; name: string; unit: string };

// ─── Edit form ────────────────────────────────────────────────────────────────

function EditItemForm({
  orgId,
  item,
  onBack,
}: {
  orgId: string;
  item: ToolItem;
  onBack: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState(item.unit);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateToolItemAction(orgId, item.id, name, unit);
      if (!result.ok) {
        toast.error(
          "error" in result ? result.error : "Failed to update item.",
        );
        return;
      }
      toast.success("Item updated.");
      onBack();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteToolItemAction(orgId, item.id);
      if (!result.ok) {
        toast.error(
          "error" in result ? result.error : "Failed to delete item.",
        );
        return;
      }
      toast.success("Item deleted.");
      onBack();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-item-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="edit-item-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          disabled={isPending}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-item-unit" className="text-sm font-medium">
          Unit
        </label>
        <Input
          id="edit-item-unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          required
          disabled={isPending}
        />
      </div>
      <Button
        type="submit"
        disabled={isPending || !name.trim() || !unit.trim()}
        className="w-full"
      >
        Save
      </Button>
      <Button
        type="button"
        variant="destructive"
        disabled={isPending}
        className="w-full"
        onClick={handleDelete}
      >
        Delete
      </Button>
    </form>
  );
}

// ─── Add form ─────────────────────────────────────────────────────────────────

interface AddItemFormProps {
  orgId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddItemForm({
  orgId,
  onSuccess,
  onCancel: _onCancel,
}: AddItemFormProps) {
  const { open } = useActionSidebar();
  const editKeyRef = useRef(0);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [createPending, startCreateTransition] = useTransition();
  const isPending = createPending;

  const loadItems = useCallback(async (query: string, nextPage: number, signal: AbortSignal) => {
    const params = new URLSearchParams({
      page: String(nextPage),
      limit: "24",
      search: query,
    });
    const response = await fetch(`/api/orgs/${orgId}/tools/item-list?${params.toString()}`, {
      signal,
    });
    if (!response.ok) throw new Error("Failed to load items.");

    const data = (await response.json()) as {
      items: Array<{ id: string; name: string; unit: string }>;
      totalPages: number;
      page: number;
    };

    return {
      items: data.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.unit,
      })),
      hasMore: data.page < data.totalPages,
    };
  }, [orgId]);

  function openEdit(item: ToolItem) {
    const k = ++editKeyRef.current;
    function goBack() {
      const k2 = ++editKeyRef.current;
      open(
        "Items",
        <div key={k2} className="p-4">
          <AddItemForm
            orgId={orgId}
            onSuccess={() => {}}
            onCancel={() => {}}
          />
        </div>,
      );
    }
    open(
      "Edit Item",
      <div key={k} className="p-4">
        <EditItemForm
          orgId={orgId}
          item={item}
          onBack={goBack}
        />
      </div>,
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startCreateTransition(async () => {
      const result = await createToolItemAction(orgId, name, unit);
      if (!result.ok) {
        toast.error(
          "error" in result ? result.error : "Failed to create item.",
        );
        return;
      }
      toast.success(`"${name.trim()}" added.`);
      setName("");
      setUnit("");
      onSuccess();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="item-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Custard"
            required
            autoFocus
            disabled={isPending}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="item-unit" className="text-sm font-medium">
            Unit
          </label>
          <Input
            id="item-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. g, ml, each"
            required
            disabled={isPending}
          />
        </div>

        <Button
          type="submit"
          disabled={createPending || !name.trim() || !unit.trim()}
          className="w-full"
        >
          Add Item
        </Button>
      </form>

      <hr className="border-border" />

      <div className="flex flex-col gap-2">
        <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Items
        </p>
        <SearchableCombobox
          items={[]}
          loadItems={loadItems}
          triggerLabel="Search items"
          placeholder="Search items…"
          emptyText="No items found"
          onSelect={(item) => {
            openEdit({
              id: item.id,
              name: item.name,
              unit: item.description ?? "",
            });
          }}
        />
      </div>
    </div>
  );
}
