"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { SearchInput } from "@/components/ui/search-input";
import type { DocNavItem, DocNavTreeNode } from "@/lib/docs";

type DocSidebarTreeProps = {
  tree: DocNavTreeNode[];
  activeSlug: string;
};

type DocSearchResult = {
  slug: string;
  title: string;
  description: string;
  breadcrumbs: string[];
  searchText: string;
};

function docHref(slug: string | null): string | null {
  if (!slug) return null;
  return `/doc/${slug}`;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function itemToSearchResult(
  item: DocNavItem,
  breadcrumbs: string[],
): DocSearchResult {
  return {
    slug: item.slug,
    title: item.title,
    description: item.description,
    breadcrumbs,
    searchText: item.searchText,
  };
}

function flattenSearchResults(
  nodes: DocNavTreeNode[],
  breadcrumbs: string[] = [],
): DocSearchResult[] {
  const results: DocSearchResult[] = [];

  for (const node of nodes) {
    const nextBreadcrumbs = node.title ? [...breadcrumbs, node.title] : breadcrumbs;

    if (node.index?.slug) {
      results.push(itemToSearchResult(node.index, breadcrumbs));
    }

    for (const page of node.pages) {
      results.push(itemToSearchResult(page, nextBreadcrumbs));
    }

    results.push(...flattenSearchResults(node.folders, nextBreadcrumbs));
  }

  return results;
}

function scoreResult(result: DocSearchResult, query: string): number {
  const title = normalizeSearchText(result.title);
  const description = normalizeSearchText(result.description);
  const breadcrumbs = normalizeSearchText(result.breadcrumbs.join(" "));
  const searchText = normalizeSearchText(result.searchText);

  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (breadcrumbs.includes(query)) return 3;
  if (description.includes(query)) return 4;
  if (searchText.includes(query)) return 5;
  return Number.POSITIVE_INFINITY;
}

function DocSearchResultCard({
  result,
  activeSlug,
}: {
  result: DocSearchResult;
  activeSlug: string;
}) {
  const href = docHref(result.slug);
  if (!href) return null;
  const isActive = result.slug === activeSlug;

  return (
    <Link
      href={href}
      className={`block rounded-lg border px-3 py-2.5 text-left transition ${
        isActive
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border/60 bg-background/40 text-foreground/90 hover:border-primary/20 hover:bg-muted/70 hover:text-foreground"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium">{result.title}</p>
          {result.breadcrumbs.length > 0 && (
            <p className="truncate text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {result.breadcrumbs.join(" / ")}
            </p>
          )}
          <p className="text-xs leading-5 text-muted-foreground">
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
}: {
  node: DocNavTreeNode;
  activeSlug: string;
  openPaths: Set<string>;
  setOpenPaths: Dispatch<SetStateAction<Set<string>>>;
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
        data-doc-sidebar-active={isActive ? "true" : undefined}
        className={`block rounded-md px-2.5 py-2 text-sm transition ${
          isActive
            ? "bg-primary/10 font-medium text-primary"
            : "text-foreground/80 hover:bg-muted hover:text-foreground"
        }`}
      >
        {node.title}
      </Link>
    ) : (
      <span
        className="block rounded-md px-2.5 py-2 text-sm font-medium text-foreground/90"
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
            data-doc-sidebar-active={isActive ? "true" : undefined}
            className={`min-w-0 flex-1 px-2.5 py-2 text-left text-sm transition ${
              isActive
                ? "bg-primary/10 font-medium text-primary"
                : "text-foreground/90 hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="block truncate">{node.title}</span>
          </Link>
        ) : (
          <span
            className="min-w-0 flex-1 px-2.5 py-2 text-sm font-medium text-foreground/90"
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
          className="shrink-0 border-l border-border/60 px-2.5 py-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
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
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DocSidebarTree({ tree, activeSlug }: DocSidebarTreeProps) {
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

  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [] as DocSearchResult[];

    return flattenSearchResults(tree)
      .filter((result) => scoreResult(result, normalizedQuery) !== Number.POSITIVE_INFINITY)
      .sort((left, right) => {
        const scoreDelta =
          scoreResult(left, normalizedQuery) - scoreResult(right, normalizedQuery);
        if (scoreDelta !== 0) return scoreDelta;

        const titleDelta = left.title.localeCompare(right.title);
        if (titleDelta !== 0) return titleDelta;

        return left.slug.localeCompare(right.slug);
      });
  }, [tree, normalizedQuery]);

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

        <p className="text-xs text-muted-foreground">
          Search titles, descriptions, and page content.
        </p>
      </div>

      {normalizedQuery ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
                />
              ))}
            </nav>
          ) : (
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-3 text-sm text-muted-foreground">
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
            />
          ))}
        </nav>
      )}
    </div>
  );
}
