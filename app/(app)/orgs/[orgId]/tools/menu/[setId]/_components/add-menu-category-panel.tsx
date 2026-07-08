"use client";

/**
 * Menu category manager panel.
 * Lets managers create, rename, delete, and reorder menu categories without
 * leaving the page sidebar.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, PencilLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createMenuTabAction,
  deleteMenuTabAction,
  reorderMenuTabsAction,
  updateMenuTabAction,
} from "@/app/actions/tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragTargetTabId, setDragTargetTabId] = useState<string | null>(null);
  const [dragInsertPosition, setDragInsertPosition] = useState<"before" | "after" | null>(null);
  const [isPending, startTransition] = useTransition();

  const orderedTabs = useMemo(
    () => [...localTabs].sort((a, b) => a.position - b.position),
    [localTabs],
  );

  function syncTabs(update: (currentTabs: typeof localTabs) => typeof localTabs) {
    setLocalTabs((currentTabs) => [...update(currentTabs)].sort((a, b) => a.position - b.position));
    router.refresh();
  }

  function reorderTabs(nextOrder: typeof localTabs) {
    const ordered = [...nextOrder].sort((a, b) => a.position - b.position);
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

  function clearDragState() {
    setDraggedTabId(null);
    setDragTargetTabId(null);
    setDragInsertPosition(null);
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

  function handleDrop(targetTabId: string) {
    if (!draggedTabId || draggedTabId === targetTabId) {
      clearDragState();
      return;
    }

    const currentOrder = [...orderedTabs];
    const fromIndex = currentOrder.findIndex((tab) => tab.id === draggedTabId);
    const toIndex = currentOrder.findIndex((tab) => tab.id === targetTabId);
    if (fromIndex < 0 || toIndex < 0) {
      clearDragState();
      return;
    }

    const nextOrder = [...currentOrder];
    const [moved] = nextOrder.splice(fromIndex, 1);
    const targetIndexAfterRemoval = nextOrder.findIndex((tab) => tab.id === targetTabId);
    const insertAfter = dragInsertPosition === "after";
    nextOrder.splice(targetIndexAfterRemoval + (insertAfter ? 1 : 0), 0, moved);

    const normalized = nextOrder.map((tab, index) => ({
      ...tab,
      position: (index + 1) * 1000,
    }));

    clearDragState();
    reorderTabs(normalized);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        {editingTabId && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancelEdit}
            disabled={isPending}
          >
            Cancel edit
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-border/70 p-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="menu-category-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="menu-category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Breakfast"
            required
            autoFocus
            disabled={isPending}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="menu-category-description" className="text-sm font-medium">
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

        <Button type="submit" disabled={isPending || !name.trim()} className="w-full">
          {isPending ? "Saving…" : editingTabId ? "Save changes" : "Add"}
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        {orderedTabs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
            No categories yet.
          </p>
        ) : (
          orderedTabs.map((tab) => {
            return (
              <div
                key={tab.id}
                draggable
                onDragStart={() => setDraggedTabId(tab.id)}
                onDragEnd={() => setDraggedTabId(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  const insertBefore = event.clientY - rect.top < rect.height / 2;
                  setDragTargetTabId(tab.id);
                  setDragInsertPosition(insertBefore ? "before" : "after");
                }}
                onDragLeave={() => {
                  if (dragTargetTabId === tab.id) {
                    setDragTargetTabId(null);
                    setDragInsertPosition(null);
                  }
                }}
                onDrop={() => handleDrop(tab.id)}
                className="flex flex-col gap-2 rounded-2xl border border-border/70 px-3 py-3 transition-colors hover:border-primary/30"
              >
                {dragTargetTabId === tab.id && dragInsertPosition === "before" ? (
                  <div className="-mt-2 h-1 rounded-full bg-primary/70 shadow-[0_0_0_1px_rgba(255,255,255,0.6)]" />
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tab.name}</p>
                      {tab.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {tab.description}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditTab(tab.id)}
                      disabled={isPending}
                      aria-label={`Edit ${tab.name}`}
                    >
                      <PencilLine className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(tab.id, tab.name)}
                      disabled={isPending}
                      aria-label={`Delete ${tab.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {dragTargetTabId === tab.id && dragInsertPosition === "after" ? (
                  <div className="-mb-2 h-1 rounded-full bg-primary/70 shadow-[0_0_0_1px_rgba(255,255,255,0.6)]" />
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}