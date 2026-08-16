"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { SearchInput } from "@/components/ui/controls/search-input";
import type { DocNavTreeNode } from "@/lib/docs";
import {
  normalizeSearchText,
  searchDocs,
  type DocSearchResult,
} from "@/lib/docs/search";

type DocSidebarTreeProps = {
  tree: DocNavTreeNode[];
  onNavigate?: () => void;
};

function docHref(slug: string | null): string | null {
  if (!slug) return null;
  return `/doc/${slug}`;
}

function activeSlugFromPathname(pathname: string): string {
  const prefix = "/doc/";
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
}

export function DocSearchResultCard({
  result,
  activeSlug,
  onNavigate,
}: {
  result: DocSearchResult;
  activeSlug: string;
  onNavigate?: () => void;
}) {
  const href = docHref(result.slug);
  if (!href) return null;
  const isActive = result.slug === activeSlug;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`block rounded-lg border px-3 py-2.5 text-left transition ${
        isActive
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border/60 bg-background/40 text-foreground/90 hover:border-primary/20 hover:bg-muted/70 hover:text-foreground"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-[13px] font-medium sm:text-sm">{result.title}</p>
          {result.breadcrumbs.length > 0 && (
            <p className="truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-xs">
              {result.breadcrumbs.join(" / ")}
            </p>
          )}
          <p className="text-[11px] leading-5 text-muted-foreground sm:text-xs">
            {result.description}
          </p>
        </div>
        {isActive && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
            Active
          </span>
        )}
      </div>
    </Link>
  );
}

function nodeHasActiveDescendant(
  node: DocNavTreeNode,
  activeSlug: string,
): boolean {
  if (node.index?.slug === activeSlug || node.slug === activeSlug) {
    return true;
  }

  return (
    node.pages.some((page) => page.slug === activeSlug) ||
    node.folders.some((folder) => nodeHasActiveDescendant(folder, activeSlug))
  );
}

function collectOpenPaths(
  nodes: DocNavTreeNode[],
  activeSlug: string,
  paths: string[] = [],
): string[] {
  for (const node of nodes) {
    if (node.path && nodeHasActiveDescendant(node, activeSlug)) {
      paths.push(node.path);
      collectOpenPaths(node.folders, activeSlug, paths);
    }
  }

  return paths;
}

function NavNode({
  node,
  activeSlug,
  openPaths,
  setOpenPaths,
  onNavigate,
}: {
  node: DocNavTreeNode;
  activeSlug: string;
  openPaths: Set<string>;
  setOpenPaths: Dispatch<SetStateAction<Set<string>>>;
  onNavigate?: () => void;
}) {
  const href = node.clickable ? docHref(node.index?.slug ?? node.slug) : null;
  const isActive = node.index?.slug === activeSlug || node.slug === activeSlug;
  const isOpen =
    openPaths.has(node.path) || nodeHasActiveDescendant(node, activeSlug);

  const toggleOpen = () => {
    if (!node.path) return;

    setOpenPaths((previous) => {
      const next = new Set(previous);
      if (next.has(node.path)) {
        next.delete(node.path);
      } else {
        next.add(node.path);
      }
      return next;
    });
  };

  if (node.pages.length === 0 && node.folders.length === 0) {
    return href ? (
      <Link
        href={href}
        onClick={onNavigate}
        data-doc-sidebar-active={isActive ? "true" : undefined}
        className={`block rounded-md px-2.5 py-2 text-[13px] transition sm:text-sm ${
          isActive
            ? "bg-primary/10 font-medium text-primary"
            : "text-foreground/80 hover:bg-muted hover:text-foreground"
        }`}
      >
        {node.title}
      </Link>
    ) : (
      <span
        className="block rounded-md px-2.5 py-2 text-[13px] font-medium text-foreground/90 sm:text-sm"
        data-doc-sidebar-active={isActive ? "true" : undefined}
      >
        {node.title}
      </span>
    );
  }

  return (
    <div>
      <div className="flex items-stretch overflow-hidden rounded-md border border-border/60 bg-background/40">
        {href ? (
          <Link
            href={href}
            onClick={onNavigate}
            data-doc-sidebar-active={isActive ? "true" : undefined}
            className={`min-w-0 flex-1 px-2.5 py-2 text-left text-[13px] transition sm:text-sm ${
              isActive
                ? "bg-primary/10 font-medium text-primary"
                : "text-foreground/90 hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="block truncate">{node.title}</span>
          </Link>
        ) : (
          <span
            className="min-w-0 flex-1 px-2.5 py-2 text-[13px] font-medium text-foreground/90 sm:text-sm"
            data-doc-sidebar-active={isActive ? "true" : undefined}
          >
            <span className="block truncate">{node.title}</span>
          </span>
        )}

        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={isOpen}
          aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.title}`}
          className="shrink-0 border-l border-border/60 px-2.5 py-2 text-[10px] text-muted-foreground transition hover:bg-muted hover:text-foreground sm:text-xs"
        >
          {isOpen ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {isOpen ? (
        <div className="mt-1 space-y-1.5 border-l border-border/60 pl-3">
          {node.pages.map((page) => (
            <Link
              key={page.slug}
              href={`/doc/${page.slug}`}
              onClick={onNavigate}
              className={`block rounded-md px-2.5 py-2 text-sm transition ${
                page.slug === activeSlug
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground/80 hover:bg-muted hover:text-foreground"
              }`}
            >
              {page.title}
            </Link>
          ))}

          {node.folders.map((folder) => (
            <NavNode
              key={folder.path}
              node={folder}
              activeSlug={activeSlug}
              openPaths={openPaths}
              setOpenPaths={setOpenPaths}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DocSidebarTree({ tree, onNavigate }: DocSidebarTreeProps) {
  const pathname = usePathname();
  const activeSlug = activeSlugFromPathname(pathname);
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = normalizeSearchText(searchQuery);
  const initialOpenPaths = useMemo(
    () => new Set(collectOpenPaths(tree, activeSlug)),
    [tree, activeSlug],
  );
  const [openPaths, setOpenPaths] = useState<Set<string>>(
    () => initialOpenPaths,
  );

  useEffect(() => {
    setOpenPaths(initialOpenPaths);
  }, [initialOpenPaths]);

  useLayoutEffect(() => {
    if (normalizedQuery) return;

    const activeElement = document.querySelector(
      '[data-doc-sidebar-active="true"]',
    ) as HTMLElement | null;
    activeElement?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeSlug, normalizedQuery]);


  const searchResults = useMemo(
    () => searchDocs(tree, searchQuery),
    [tree, searchQuery],
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="relative">
          <SearchInput
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            type="search"
            placeholder="Search docs"
            aria-label="Search docs"
            className="pr-9"
            containerClassName="w-full"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear docs search"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground sm:text-xs">
          Search titles, descriptions, and page content.
        </p>
      </div>

      {normalizedQuery ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">
              {searchResults.length} result{searchResults.length === 1 ? "" : "s"}
            </p>
          </div>

          {searchResults.length > 0 ? (
            <nav className="space-y-2">
              {searchResults.map((result) => (
                <DocSearchResultCard
                  key={result.slug}
                  result={result}
                  activeSlug={activeSlug}
                  onNavigate={onNavigate}
                />
              ))}
            </nav>
          ) : (
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-3 text-[13px] text-muted-foreground sm:text-sm">
              No docs match “{searchQuery.trim()}”. Try a different term or clear the search.
            </div>
          )}
        </div>
      ) : (
        <nav className="space-y-1.5">
          {tree.map((node) => (
            <NavNode
              key={node.path}
              node={node}
              activeSlug={activeSlug}
              openPaths={openPaths}
              setOpenPaths={setOpenPaths}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      )}
    </div>
  );
}
