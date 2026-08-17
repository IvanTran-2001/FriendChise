"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialogs/dialog";
import { SearchInput } from "@/components/ui/controls/search-input";
import type { DocNavTreeNode } from "@/lib/docs";
import { searchDocs } from "@/lib/docs/search";

type DocSearchDialogProps = {
  tree: DocNavTreeNode[];
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function DocSearchDialog({ tree }: DocSearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) {
          handleOpenChange(false);
        } else {
          setOpen(true);
        }
        return;
      }

      if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleOpenChange]);

  const results = useMemo(() => searchDocs(tree, query).slice(0, 12), [tree, query]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search docs"
        className="flex h-9 items-center gap-2 rounded-full border border-border/70 bg-background/85 px-3 text-xs font-medium text-muted-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/20 hover:bg-background hover:text-foreground hover:shadow-md"
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Search docs</span>
        <kbd className="hidden rounded border border-border/70 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          Meta+K / Ctrl+K
        </kbd>
      </button>

      <DialogContent className="top-[18%] max-w-lg translate-y-0 gap-3 p-4">
        <DialogHeader className="mb-0">
          <DialogTitle className="sr-only">Search documentation</DialogTitle>
          <SearchInput
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search docs..."
            aria-label="Search docs"
            containerClassName="w-full"
          />
        </DialogHeader>

        <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
          {query.trim() && results.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No docs match “{query.trim()}”.
            </p>
          )}

          {results.map((result) => (
            <Link
              key={result.slug}
              href={`/doc/${result.slug}`}
              onClick={() => handleOpenChange(false)}
              className="block rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-left transition hover:border-primary/20 hover:bg-muted/70"
            >
              <p className="truncate text-sm font-medium text-foreground/90">
                {result.title}
              </p>
              {result.breadcrumbs.length > 0 && (
                <p className="truncate text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {result.breadcrumbs.join(" / ")}
                </p>
              )}
              <p className="truncate text-xs text-muted-foreground">
                {result.description}
              </p>
            </Link>
          ))}

          {!query.trim() && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Start typing to search titles, descriptions, and page content.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
