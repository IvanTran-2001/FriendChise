"use client";

import { useTransition, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Toolbar } from "@/components/layout/toolbar";
import { SearchInput } from "@/components/ui/search-input";
import { toast } from "sonner";
import { deleteTagAction } from "@/app/actions/tags";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EditTagForm } from "./_components/tag-form";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tag = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  _count: { tasks: number };
};

// ─── Tag row ──────────────────────────────────────────────────────────────────

function TagRow({ orgId, tag }: { orgId: string; tag: Tag }) {
  const { open, close } = useActionSidebar();
  const [isPending, startTransition] = useTransition();
  const editKeyRef = useRef(0);

  function handleEdit() {
    const k = ++editKeyRef.current;
    open(
      "Edit Tag",
      <EditTagForm
        key={k}
        orgId={orgId}
        tagId={tag.id}
        defaultName={tag.name}
        defaultColor={tag.color}
        isDefault={tag.isDefault}
        onSuccess={close}
      />,
    );
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTagAction(orgId, tag.id);
      if (result.ok) {
        toast.success(`Tag "${tag.name}" deleted.`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Color dot */}
      <span
        className="inline-block w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: tag.color }}
      />

      {/* Name + badges */}
      <span className="flex-1 text-sm font-medium">{tag.name}</span>
      {tag.isDefault && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          default
        </span>
      )}

      {/* Task count */}
      <span className="text-xs text-muted-foreground tabular-nums">
        {tag._count.tasks} {tag._count.tasks === 1 ? "task" : "tasks"}
      </span>

      {/* Edit */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleEdit}
        disabled={isPending}
        aria-label={`Edit ${tag.name}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      {/* Delete — hidden for default tags */}
      {!tag.isDefault && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              disabled={isPending}
              aria-label={`Delete ${tag.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &ldquo;{tag.name}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the tag from all{" "}
                {tag._count.tasks > 0 ? (
                  <strong>{tag._count.tasks} task{tag._count.tasks !== 1 ? "s" : ""}</strong>
                ) : (
                  "tasks"
                )}
                . This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// ─── Tags client ──────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  tags: Tag[];
}

export function TagsClient({ orgId, tags }: Props) {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim().toLowerCase();
  const filtered = trimmedQuery
    ? tags.filter((t) => t.name.toLowerCase().includes(trimmedQuery))
    : tags;

  return (
    <>
      <Toolbar>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tags…"
          className="h-8 text-sm"
          containerClassName="flex-1 max-w-xs"
          aria-label="Search tags"
        />
      </Toolbar>

      <div className="max-w-3xl mx-auto w-full">
        {filtered.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {query.trim() ? "No tags match your search." : "No tags yet."}
            </p>
            {!query.trim() && (
              <p className="mt-1 text-xs text-muted-foreground">
                Use &ldquo;Add Tag&rdquo; in the sidebar to create one.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 border-b bg-muted/40">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tags
              </span>
            </div>
            {filtered.map((tag, i) => (
              <div key={tag.id} className={i < filtered.length - 1 ? "border-b" : ""}>
                <TagRow orgId={orgId} tag={tag} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
