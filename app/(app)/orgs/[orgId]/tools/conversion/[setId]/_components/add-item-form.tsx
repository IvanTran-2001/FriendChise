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

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  onUpdate,
  onDelete,
  onBack,
}: {
  orgId: string;
  item: ToolItem;
  onUpdate: (updated: ToolItem) => void;
  onDelete: (id: string) => void;
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
      onUpdate({ ...item, name: name.trim(), unit: unit.trim() });
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
      onDelete(item.id);
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
  toolItems: ToolItem[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddItemForm({
  orgId,
  toolItems,
  onSuccess,
  onCancel: _onCancel,
}: AddItemFormProps) {
  const { open } = useActionSidebar();
  const editKeyRef = useRef(0);
  const [items, setItems] = useState(toolItems);
  const itemsRef = useRef(items);

  function updateItems(fn: (prev: ToolItem[]) => ToolItem[]) {
    const next = fn(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
  }
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const filterQuery = search || name;
  const filteredItems = filterQuery
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
          i.unit.toLowerCase().includes(filterQuery.toLowerCase()),
      )
    : items;

  function openEdit(item: ToolItem) {
    const k = ++editKeyRef.current;
    function goBack() {
      const k2 = ++editKeyRef.current;
      open(
        "Items",
        <div key={k2} className="p-4">
          <AddItemForm
            orgId={orgId}
            toolItems={itemsRef.current}
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
          onUpdate={(updated) =>
            updateItems((prev) =>
              prev.map((i) => (i.id === updated.id ? updated : i)),
            )
          }
          onDelete={(id) =>
            updateItems((prev) => prev.filter((i) => i.id !== id))
          }
          onBack={goBack}
        />
      </div>,
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createToolItemAction(orgId, name, unit);
      if (!result.ok) {
        toast.error(
          "error" in result ? result.error : "Failed to create item.",
        );
        return;
      }
      updateItems((prev) => [...prev, result.item]);
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
          disabled={isPending || !name.trim() || !unit.trim()}
          className="w-full"
        >
          Add Item
        </Button>
      </form>

      <hr className="border-border" />

      {/* Item list */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Items
          </span>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-7 w-32 text-xs"
          />
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No items yet.</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No matches.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => openEdit(item)}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 cursor-pointer hover:border-primary/40 transition-colors"
              >
                <span className="text-sm font-medium truncate">
                  {item.name.length > 20
                    ? item.name.slice(0, 20) + "…"
                    : item.name}
                </span>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">
                  {item.unit.length > 3 ? item.unit.slice(0, 3) : item.unit}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
