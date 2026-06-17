"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { DocNavTreeNode } from "@/lib/docs";

type DocSidebarTreeProps = {
  tree: DocNavTreeNode[];
  activeSlug: string;
};

function docHref(slug: string | null): string | null {
  if (!slug) return null;
  return `/doc/${slug}`;
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
        className={`block rounded-md px-2.5 py-2 text-sm transition ${
          isActive
            ? "bg-primary/10 font-medium text-primary"
            : "text-foreground/80 hover:bg-muted hover:text-foreground"
        }`}
      >
        {node.title}
      </Link>
    ) : (
      <span className="block rounded-md px-2.5 py-2 text-sm font-medium text-foreground/90">
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
            className={`min-w-0 flex-1 px-2.5 py-2 text-left text-sm transition ${
              isActive
                ? "bg-primary/10 font-medium text-primary"
                : "text-foreground/90 hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="block truncate">{node.title}</span>
          </Link>
        ) : (
          <span className="min-w-0 flex-1 px-2.5 py-2 text-sm font-medium text-foreground/90">
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
  const initialOpenPaths = useMemo(
    () => new Set(collectOpenPaths(tree, activeSlug)),
    [tree, activeSlug],
  );
  const [openPaths, setOpenPaths] = useState<Set<string>>(
    () => initialOpenPaths,
  );

  return (
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
  );
}
