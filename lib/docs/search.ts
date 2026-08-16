import type { DocNavItem, DocNavTreeNode } from "@/lib/docs";

export type DocSearchResult = {
  slug: string;
  title: string;
  description: string;
  breadcrumbs: string[];
  searchText: string;
};

export function normalizeSearchText(value: string): string {
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

export function flattenSearchResults(
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

export function scoreResult(result: DocSearchResult, query: string): number {
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

/** Ranked, partial-match search over the doc nav tree. Returns [] for an empty query. */
export function searchDocs(
  tree: DocNavTreeNode[],
  rawQuery: string,
): DocSearchResult[] {
  const query = normalizeSearchText(rawQuery);
  if (!query) return [];

  return flattenSearchResults(tree)
    .filter((result) => scoreResult(result, query) !== Number.POSITIVE_INFINITY)
    .sort((left, right) => {
      const scoreDelta = scoreResult(left, query) - scoreResult(right, query);
      if (scoreDelta !== 0) return scoreDelta;

      const titleDelta = left.title.localeCompare(right.title);
      if (titleDelta !== 0) return titleDelta;

      return left.slug.localeCompare(right.slug);
    });
}
