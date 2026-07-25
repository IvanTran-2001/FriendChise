"use client";

import { useTransition } from "react";
import { Plus, ArrowUp, ArrowDown, Trash2, MoreVertical, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
import { CreatePagePanel } from "./create-page-panel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteNotePageAction, reorderNotePagesAction } from "@/app/actions/tools/notes";
import { toast } from "sonner";
import { cn } from "@/lib/core/utils";

type NotePage = {
  id: string;
  title: string;
  content: string;
  position: number;
  orgId: string;
  createdAt: Date;
  updatedAt: Date;
};

interface NotesSidebarContentProps {
  orgId: string;
  pages: NotePage[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onCreatedPage: (page: NotePage) => void;
  onDeletedPage: (id: string) => void;
  onReorderPages: (nextOrder: NotePage[]) => void;
}

export function NotesSidebarContent({
  orgId,
  pages,
  activePageId,
  onSelectPage,
  onCreatedPage,
  onDeletedPage,
  onReorderPages,
}: NotesSidebarContentProps) {
  const { open, close } = useActionSidebar();
  const [isPending, startTransition] = useTransition();

  function handleCreateClick() {
    open(
      "New Page",
      <CreatePagePanel
        orgId={orgId}
        onCreated={(page) => {
          onCreatedPage(page);
          onSelectPage(page.id);
        }}
        onClose={close}
      />,
    );
  }

  function handleDelete(pageId: string, pageTitle: string) {
    if (!confirm(`Are you sure you want to delete the page "${pageTitle}"?`)) return;

    startTransition(async () => {
      const result = await deleteNotePageAction(orgId, pageId);
      if (!result.ok) {
        toast.error("Failed to delete page.");
        return;
      }
      toast.success(`"${pageTitle}" deleted.`);
      onDeletedPage(pageId);
    });
  }

  function handleMove(index: number, direction: "up" | "down") {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= pages.length) return;

    const reordered = [...pages];
    const temp = reordered[index];
    reordered[index] = reordered[nextIndex];
    reordered[nextIndex] = temp;

    // Instantly update UI locally
    onReorderPages(reordered);

    // Call server action to persist
    startTransition(async () => {
      const pageIds = reordered.map((p) => p.id);
      const result = await reorderNotePagesAction(orgId, pageIds);
      if (!result.ok) {
        toast.error("Failed to save new order.");
      }
    });
  }

  return (
    <>
      {/* Actions */}
      <div className="px-3 py-3 flex flex-col gap-2 border-t border-border">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1">
          Actions
        </span>
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleCreateClick}
          disabled={isPending}
        >
          <Plus className="h-4 w-4" />
          New Page
        </Button>
      </div>

      {/* Pages List */}
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-2 border-t border-border flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
            Notebook Pages
          </span>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground bg-muted/40 rounded-md px-1.5 py-0.5">
            {pages.length}
          </span>
        </div>

        {pages.length === 0 ? (
          <p className="px-1 py-3 text-xs text-muted-foreground italic">
            No pages created yet.
          </p>
        ) : (
          <nav className="flex flex-col gap-1">
            {pages.map((page, index) => {
              const isActive = page.id === activePageId;
              return (
                <div
                  key={page.id}
                  className={cn(
                    "group flex items-center justify-between gap-1 rounded-2xl border px-3 py-2.5 text-[13px] transition-all duration-150 relative overflow-hidden",
                    isActive
                      ? "border-sidebar-border/70 bg-sidebar-primary/10 shadow-sm"
                      : "border-border bg-card/70 hover:border-primary/25 hover:bg-card hover:shadow-sm"
                  )}
                >
                  {/* Left indicator bar */}
                  <span
                    className={cn(
                      "absolute left-0 top-0 h-full w-1 rounded-r-full transition-opacity",
                      isActive ? "bg-violet-500" : "bg-transparent opacity-0 group-hover:opacity-100 group-hover:bg-violet-500/40"
                    )}
                  />

                  <button
                    onClick={() => onSelectPage(page.id)}
                    className="flex-1 text-left font-medium text-sidebar-foreground min-w-0 flex items-center gap-2"
                  >
                    <FileText className={cn("h-4 w-4 shrink-0", isActive ? "text-violet-500" : "text-muted-foreground")} />
                    <span className="truncate pr-1">{page.title || "Untitled Page"}</span>
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 shrink-0"
                        disabled={isPending}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem
                        disabled={index === 0}
                        onClick={() => handleMove(index, "up")}
                      >
                        <ArrowUp className="mr-2 h-3.5 w-3.5" />
                        Move Up
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={index === pages.length - 1}
                        onClick={() => handleMove(index, "down")}
                      >
                        <ArrowDown className="mr-2 h-3.5 w-3.5" />
                        Move Down
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        onClick={() => handleDelete(page.id, page.title)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </nav>
        )}
      </div>
    </>
  );
}
