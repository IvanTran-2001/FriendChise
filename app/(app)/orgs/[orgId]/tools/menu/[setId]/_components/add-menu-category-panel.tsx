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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { GripVertical, MoreVertical } from "lucide-react";

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

      <div className="space-y-2">
        {orderedTabs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-3 py-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">No categories yet.</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Create the first category above. It will appear here and can be reordered later.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {orderedTabs.map((tab) => {
              const isEditingThisTab = editingTabId === tab.id;

              return (
                <div
                  key={tab.id}
                  draggable
                  onDragStart={() => setDraggedTabId(tab.id)}
                  onDragEnd={clearDragState}
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
                  className={[
                    "flex flex-col gap-2 rounded-2xl border px-3 py-3 transition-all",
                    isEditingThisTab
                      ? "border-primary/30 bg-primary/5 shadow-sm"
                      : "border-border/70 bg-background/80 hover:border-primary/30 hover:bg-muted/20",
                  ].join(" ")}
                >
                  {dragTargetTabId === tab.id && dragInsertPosition === "before" ? (
                    <div className="-mt-2 h-1 rounded-full bg-primary/70 shadow-[0_0_0_1px_rgba(255,255,255,0.6)]" />
                  ) : null}

                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/45" />
                    <div className="relative min-w-0 flex-1 pr-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-7 w-7 rounded-full"
                            disabled={isPending}
                            aria-label={`Open actions for ${tab.name}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-40">
                          <DropdownMenuItem onSelect={() => handleEditTab(tab.id)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => handleMoveTab(tab.id, "up")}
                            disabled={isPending || orderedTabs[0]?.id === tab.id}
                          >
                            Move up
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => handleMoveTab(tab.id, "down")}
                            disabled={isPending || orderedTabs[orderedTabs.length - 1]?.id === tab.id}
                          >
                            Move down
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => handleDelete(tab.id, tab.name)}
                            disabled={isPending}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <div className="flex items-start gap-0.5">
                        <p className="min-w-0 flex-1 text-[12px] font-semibold leading-3 wrap-break-word pr-1">
                          {tab.name}
                        </p>
                      </div>
                      {tab.description ? (
                        <p className="mt-px line-clamp-2 text-[10px] leading-3 text-muted-foreground">
                          {tab.description}
                        </p>
                      ) : (
                        <p className="mt-px text-[10px] leading-3 text-muted-foreground/60">No description</p>
                      )}
                    </div>
                  </div>

                  {dragTargetTabId === tab.id && dragInsertPosition === "after" ? (
                    <div className="-mb-2 h-1 rounded-full bg-primary/70 shadow-[0_0_0_1px_rgba(255,255,255,0.6)]" />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}