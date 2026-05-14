"use client";

/**
 * TagFilterButton — searchable tag filter for sidebar filter sections.
 *
 * Opens a Popover with a live-search input and a list of org tags.
 * Selecting a tag (or clearing) calls router.push with the new URL built from
 * `basePath` + `extraParams` + the chosen tagId.
 *
 * Usage:
 * ```tsx
 * <TagFilterButton
 *   tags={tags}
 *   selectedTagId={tagId}
 *   basePath={`/orgs/${orgId}/tasks`}
 *   extraParams={{ sort, ...(roleId ? { roleId } : {}), ...(view !== "list" ? { view } : {}) }}
 * />
 * ```
 */
import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Tag = { id: string; name: string; color: string };

interface TagFilterButtonProps {
  tags: Tag[];
  selectedTagId: string | null;
  /** Path portion of the URL, e.g. `/orgs/abc/tasks` */
  basePath: string;
  /**
   * Other URL params to preserve when navigating.
   * tagId is automatically appended / omitted — do NOT include it here.
   */
  extraParams: Record<string, string>;
}

export function TagFilterButton({
  tags,
  selectedTagId,
  basePath,
  extraParams,
}: TagFilterButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedTag = tags.find((t) => t.id === selectedTagId) ?? null;
  const filtered = tags.filter(
    (t) =>
      !search.trim() ||
      t.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function navigate(tagId: string | null) {
    setOpen(false);
    setSearch("");
    const params = new URLSearchParams(extraParams);
    if (tagId) params.set("tagId", tagId);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant={selectedTagId ? "secondary" : "outline"}
          size="sm"
          type="button"
          className="w-full justify-between gap-1.5"
          aria-label="Filter by tag"
        >
          <span className="flex items-center gap-1.5 truncate min-w-0">
            {selectedTag ? (
              <>
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedTag.color }}
                />
                <span className="truncate">{selectedTag.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">All tags</span>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0"
        style={{ minWidth: "var(--radix-popover-trigger-width)" }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b px-1 py-1">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags…"
            className="h-7 border-0 shadow-none focus-visible:ring-0 text-sm"
          />
        </div>
        <ul className="max-h-52 overflow-y-auto py-1">
          {selectedTagId && (
            <li>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded"
                onClick={() => navigate(null)}
              >
                <X className="h-3 w-3 shrink-0 text-muted-foreground" />
                All tags
              </button>
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-center text-xs text-muted-foreground">
              No tags found
            </li>
          ) : (
            filtered.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded"
                  onClick={() => navigate(tag.id)}
                >
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 truncate text-left">{tag.name}</span>
                  {tag.id === selectedTagId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
