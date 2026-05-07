"use client";

/**
 * @file templates-client.tsx
 * Client component for the timetable templates list page.
 *
 * Renders a toolbar with a Card/List view toggle and a "+" button to create a new template.
 * Each template card/row shows its name, cycle length, and entry count.
 *
 * MANAGE_TASKS holders see a ··· dropdown on each item with three actions:
 * - **Rename** — opens an inline Dialog with a text input; commits via `renameTemplateAction`.
 * - **Duplicate** — calls `duplicateTemplateAction` and refreshes; the copy is named
 *   "Copy of <original>" (with a numeric suffix on collision).
 * - **Delete** — opens an AlertDialog confirmation; commits via `deleteTemplateAction`.
 *
 * View preference (card vs list) is URL-driven via the `view` prop.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Copy,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toolbar } from "@/components/layout/toolbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  renameTemplateAction,
  duplicateTemplateAction,
  deleteTemplateAction,
} from "@/app/actions/templates";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CreateTemplateForm } from "./_components/create-template-form";

type Template = {
  id: string;
  name: string;
  cycleLengthDays: number;
  _count: { entries: number };
};

interface TemplatesClientProps {
  orgId: string;
  templates: Template[];
  view: "card" | "list";
}

// ---------------------------------------------------------------------------
// Per-template action menu (shared between card + list views)
// ---------------------------------------------------------------------------

function TemplateMenu({
  orgId,
  template,
}: {
  orgId: string;
  template: Template;
}) {
  const router = useRouter();
  const [isPending, startT] = useTransition();

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState(template.name);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleRename() {
    setRenameName(template.name);
    setRenameError(null);
    setRenameOpen(true);
  }

  function submitRename() {
    const trimmed = renameName.trim();
    if (!trimmed) {
      setRenameError("Name is required");
      return;
    }
    startT(async () => {
      const res = await renameTemplateAction(orgId, template.id, trimmed);
      if (!res.ok) {
        setRenameError(res.error ?? "Failed to rename");
        return;
      }
      setRenameOpen(false);
      router.refresh();
    });
  }

  function handleDuplicate() {
    setDuplicateError(null);
    startT(async () => {
      const result = await duplicateTemplateAction(orgId, template.id);
      if (!result.ok) {
        setDuplicateError(result.error ?? "Failed to duplicate");
        return;
      }
      router.refresh();
    });
  }

  function confirmDelete() {
    setDeleteError(null);
    startT(async () => {
      const result = await deleteTemplateAction(orgId, template.id);
      if (!result.ok) {
        setDeleteError(result.error ?? "Failed to delete");
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={(e) => e.preventDefault()}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Template actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={handleRename}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDuplicate} disabled={isPending}>
            <Copy className="h-3.5 w-3.5 mr-2" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Duplicate error display */}
      {duplicateError && (
        <div className="absolute top-12 right-0 z-50 bg-destructive text-destructive-foreground text-xs px-3 py-2 rounded-md shadow-lg max-w-xs">
          {duplicateError}
        </div>
      )}

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename template</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-2">
            <Input
              value={renameName}
              onChange={(e) => {
                setRenameName(e.target.value);
                setRenameError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && submitRename()}
              autoFocus
            />
            {renameError && (
              <p className="text-xs text-destructive">{renameError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRename} disabled={isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{template.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template and all its slots. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-xs text-destructive px-6">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function TemplatesClient({
  orgId,
  templates,
  view,
}: TemplatesClientProps) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const handler = () => setCreateOpen(true);
    window.addEventListener("templates:open-create", handler);
    return () => window.removeEventListener("templates:open-create", handler);
  }, []);
  const filtered = query.trim()
    ? templates.filter((t) =>
        t.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : templates;

  if (templates.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 opacity-30" />
          <p className="text-sm">No templates yet. Create one to get started.</p>
        </div>
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetContent side="bottom" className="p-0 flex flex-col rounded-t-2xl overflow-hidden">
            <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
              <SheetTitle>New Template</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <CreateTemplateForm orgId={orgId} />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <>
      <Toolbar>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates…"
          className="h-8 text-sm"
          containerClassName="flex-1 max-w-xs"
        />
      </Toolbar>
      {/* Card view */}
      {view === "card" ? (
        filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            No templates match &ldquo;{query}&rdquo;.
          </p>
        ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="group relative border bg-card hover:shadow-md transition-all overflow-hidden"
            >
              <Link
                href={`/orgs/${orgId}/timetable/templates/${t.id}`}
                className="flex items-start gap-4 p-5 pr-12"
              >
                <div className="flex h-10 w-10 items-center justify-center bg-primary/10 text-primary shrink-0 group-hover:bg-primary/15 transition-colors mt-0.5">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm leading-snug truncate">
                    {t.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="inline-flex items-center bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {t.cycleLengthDays} days
                    </span>
                    <span className="inline-flex items-center bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {t._count.entries} slots
                    </span>
                  </div>
                </div>
              </Link>
              <div className="absolute top-3 right-3">
                <TemplateMenu orgId={orgId} template={t} />
              </div>
            </div>
          ))}
        </div>
        )
      ) : (
        /* List view */
        filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            No templates match &ldquo;{query}&rdquo;.
          </p>
        ) : (
        <div className="border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Name
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Cycle
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Slots
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className="border-b last:border-0 hover:bg-primary/5 transition-colors group"
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/orgs/${orgId}/timetable/templates/${t.id}`}
                      className="hover:underline"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.cycleLengthDays} days
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t._count.entries}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <TemplateMenu orgId={orgId} template={t} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )
      )}
      {/* Mobile create sheet — rendered here so it survives sidebar close */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="p-0 flex flex-col rounded-t-2xl overflow-hidden">
          <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
            <SheetTitle>New Template</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <CreateTemplateForm orgId={orgId} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
