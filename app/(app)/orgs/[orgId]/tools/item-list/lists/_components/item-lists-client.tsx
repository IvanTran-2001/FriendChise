"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  Copy,
  ArrowRight,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Clock,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import { ListDisplayType } from "@prisma/client";
import {
  deleteToolItemListAction,
  duplicateToolItemListAction,
  updateToolItemListAction,
} from "@/app/actions/tools";

type ToolItemList = {
  id: string;
  name: string;
  description: string | null;
  displayType: ListDisplayType;
  updatedAt: Date;
  _count: { entries: number };
};

interface ItemListsClientProps {
  orgId: string;
  /** Current list of item lists — owned by ItemListsPageClient so create/edit/delete stay in sync across sidebar and main content. */
  lists: ToolItemList[];
  recentLists: {
    id: string;
    entityKey: string;
    entityName: string;
    entityHref: string | null;
    lastUsedAt: Date;
  }[];
  /** State setter passed down from ItemListsPageClient; allows in-place mutations without router.refresh(). */
  onListsChange: React.Dispatch<React.SetStateAction<ToolItemList[]>>;
  canManage: boolean;
  view: "list" | "card";
}

const DISPLAY_TYPE_LABEL: Record<ListDisplayType, string> = {
  TABLE: "Table",
  GRID: "Grid",
  CHECKLIST: "Checklist",
  GALLERY: "Gallery",
};

const DISPLAY_TYPE_ICON: Record<ListDisplayType, React.ElementType> = {
  TABLE: LayoutGrid,
  GRID: LayoutGrid,
  CHECKLIST: CheckSquare,
  GALLERY: LayoutGrid,
};

export function ItemListsClient({
  orgId,
  lists,
  recentLists,
  onListsChange: setLists,
  canManage,
  view,
}: ItemListsClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  // Inline editing state: { id, name, description }
  const [editing, setEditing] = useState<{ id: string; name: string; description: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function goToList(listId: string) {
    router.push(`/orgs/${orgId}/tools/item-list/lists/${listId}`);
  }

  function startEdit(list: ToolItemList) {
    setEditing({ id: list.id, name: list.name, description: list.description ?? "" });
  }

  function commitEdit() {
    if (!editing) return;
    const { id, name, description } = editing;
    setEditing(null);
    startTransition(async () => {
      const result = await updateToolItemListAction(orgId, id, name, description || null);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to rename list.");
        return;
      }
      setLists((prev) =>
        prev
          .map((l) => (l.id === id ? { ...l, name: name.trim(), description: description || null } : l))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    });
  }

  function handleDuplicate(list: ToolItemList) {
    startTransition(async () => {
      const result = await duplicateToolItemListAction(orgId, list.id);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to duplicate list.");
        return;
      }
      setLists((prev) =>
        [...prev, result.list].sort((a, b) => a.name.localeCompare(b.name)),
      );
      toast.success(`"${result.list.name}" created.`);
    });
  }

  function handleDelete(list: ToolItemList) {
    startTransition(async () => {
      const result = await deleteToolItemListAction(orgId, list.id);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to delete list.");
        return;
      }
      setLists((prev) => prev.filter((l) => l.id !== list.id));
      toast.success(`"${list.name}" deleted.`);
    });
  }

  const filtered = search
    ? lists.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
    : lists;
  const recent = recentLists
    .map((item) => ({
      id: item.entityKey,
      name: item.entityName,
      href: item.entityHref ?? `/orgs/${orgId}/tools/item-list/lists/${item.entityKey}`,
      usedAt: item.lastUsedAt,
    }))
    .filter((item) => lists.some((list) => list.id === item.id));

  return (
    <>
      <RegisterPageToolbar>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            aria-label="Search lists"
            placeholder="Search lists…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-7"
          />
        </div>
      </RegisterPageToolbar>

      <div>
        {recent.length > 0 && !search && (
          <section className="mb-6 flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Recent lists
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Jump back into the lists you opened recently.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {recent.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className="group rounded-3xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/15 dark:text-sky-300">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{item.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Open list</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {lists.length === 0 ? (
          <div className="flex items-center justify-center border rounded-lg py-24">
            <div className="flex flex-col items-center gap-3 text-center">
              <List className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-2xl font-semibold">No lists yet</p>
              {canManage && (
                <p className="text-sm text-muted-foreground">
                  Create a list to organise items for a job or station.
                </p>
              )}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center border rounded-lg py-16">
            <p className="text-sm text-muted-foreground">
              No lists match &ldquo;{search}&rdquo;
            </p>
          </div>
        ) : view === "card" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map((list) => {
              const Icon = DISPLAY_TYPE_ICON[list.displayType];
              const isEditingThis = editing?.id === list.id;
              return (
                <div
                  key={list.id}
                  onClick={() => { if (!isEditingThis) goToList(list.id); }}
                  className="relative flex flex-col gap-2 rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
                        {list._count.entries}
                      </span>
                      {canManage && (
                        <ListMenu
                          list={list}
                          onEdit={startEdit}
                          onDuplicate={handleDuplicate}
                          onDelete={handleDelete}
                          disabled={isPending}
                        />
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    {isEditingThis ? (
                      <InlineEditForm
                        editing={editing}
                        onChange={setEditing}
                        onCommit={commitEdit}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <>
                        <p className="text-sm font-medium truncate">{list.name}</p>
                        {list.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {list.description}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {DISPLAY_TYPE_LABEL[list.displayType]}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border overflow-hidden bg-card shadow-sm">
            {filtered.map((list) => {
              const Icon = DISPLAY_TYPE_ICON[list.displayType];
              const isEditingThis = editing?.id === list.id;
              return (
                <div
                  key={list.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group"
                >
                  <div
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => { if (!isEditingThis) goToList(list.id); }}
                  >
                    <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditingThis ? (
                        <InlineEditForm
                          editing={editing}
                          onChange={setEditing}
                          onCommit={commitEdit}
                          onCancel={() => setEditing(null)}
                        />
                      ) : (
                        <>
                          <p className="text-sm font-medium truncate">{list.name}</p>
                          {list.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {list.description}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
                      {list._count.entries} item{list._count.entries !== 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
                      {DISPLAY_TYPE_LABEL[list.displayType]}
                    </span>
                    {canManage && (
                      <ListMenu
                        list={list}
                        onEdit={startEdit}
                        onDuplicate={handleDuplicate}
                        onDelete={handleDelete}
                        disabled={isPending}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ListMenu({
  list,
  onEdit,
  onDuplicate,
  onDelete,
  disabled,
}: {
  list: ToolItemList;
  onEdit: (list: ToolItemList) => void;
  onDuplicate: (list: ToolItemList) => void;
  onDelete: (list: ToolItemList) => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">List actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => onEdit(list)}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDuplicate(list)}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onDelete(list)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InlineEditForm({
  editing,
  onChange,
  onCommit,
  onCancel,
}: {
  editing: { id: string; name: string; description: string };
  onChange: (v: { id: string; name: string; description: string }) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-1"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Input
        autoFocus
        value={editing.name}
        onChange={(e) => onChange({ ...editing, name: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onCommit(); }
          if (e.key === "Escape") onCancel();
        }}
        onBlur={onCommit}
        className="h-7 text-sm font-medium"
        placeholder="List name"
      />
      <Input
        value={editing.description}
        onChange={(e) => onChange({ ...editing, description: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onCommit(); }
          if (e.key === "Escape") onCancel();
        }}
        onBlur={onCommit}
        className="h-6 text-xs"
        placeholder="Description (optional)"
      />
    </div>
  );
}

