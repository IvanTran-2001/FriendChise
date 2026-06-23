import fs from "fs/promises";
import path from "path";

export type DocNavItem = {
  slug: string;
  title: string;
  description: string;
  searchText: string;
  relativePath: string;
  fileName: string;
  isIndex: boolean;
  folderPath: string;
  hasContent: boolean;
  isRenderable: boolean;
  order: number | null;
};

export type DocNavTreeNode = {
  title: string;
  description: string;
  slug: string | null;
  path: string;
  index: DocNavItem | null;
  pages: DocNavItem[];
  folders: DocNavTreeNode[];
  clickable: boolean;
  order: number | null;
};

export type DocHeading = {
  id: string;
  text: string;
  level: 2 | 3;
};

const DOC_ROOT = path.join(process.cwd(), "docs");

function titleCaseSegment(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function slugFromRelativePath(relativePath: string): string {
  return relativePath.replace(/\.md$/i, "").split(path.sep).join("/");
}

function routeSlugFromRelativePath(relativePath: string): string {
  const fileName = path.basename(relativePath).toLowerCase();

  if (fileName === "index.md") {
    const folderPath = path.dirname(relativePath);
    if (folderPath === ".") return "";
    return folderPath.split(path.sep).join("/");
  }

  return slugFromRelativePath(relativePath);
}

function normalizeDocSlug(slug: string): string {
  return slug
    .trim()
    .replace(/\.md$/i, "")
    .replace(/\/index$/i, "");
}

function folderPathFromRelativePath(relativePath: string): string {
  const folderPath = path.dirname(relativePath);
  return folderPath === "." ? "" : folderPath.split(path.sep).join("/");
}

function fileNameFromRelativePath(relativePath: string): string {
  return path.basename(relativePath);
}

function displayTitleFromSlug(slug: string): string {
  return slug
    .split("/")
    .map((segment) => titleCaseSegment(segment))
    .join(" / ");
}

type Frontmatter = {
  title?: string;
  description?: string;
  order?: number;
};

function parseFrontmatter(markdown: string): {
  frontmatter: Frontmatter;
  body: string;
} {
  const trimmed = markdown.trimStart();
  if (!trimmed.startsWith("---\n")) {
    return { frontmatter: {}, body: markdown };
  }

  const closingIndex = trimmed.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return { frontmatter: {}, body: markdown };
  }

  const rawFrontmatter = trimmed.slice(4, closingIndex);
  const body = trimmed.slice(closingIndex + 5);
  const frontmatter: Frontmatter = {};

  for (const line of rawFrontmatter.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key || !value) continue;

    if (key === "title") {
      frontmatter.title = value;
      continue;
    }

    if (key === "description") {
      frontmatter.description = value;
      continue;
    }

    if (key === "order") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        frontmatter.order = parsed;
      }
    }
  }

  return { frontmatter, body };
}

function extractTitle(markdown: string, fallback: string): string {
  const { frontmatter, body } = parseFrontmatter(markdown);

  if (frontmatter.title) return frontmatter.title;

  const lines = body.split("\n");
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)/);
    if (match) return match[1].trim();
  }
  return fallback;
}

function extractDescription(markdown: string): string {
  const { frontmatter, body } = parseFrontmatter(markdown);

  if (frontmatter.description) return frontmatter.description;

  const lines = body.split("\n");
  let sawTitle = false;
  const paragraphLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!sawTitle) {
      if (line.startsWith("# ")) {
        sawTitle = true;
      }
      continue;
    }

    if (!line) {
      if (paragraphLines.length > 0) break;
      continue;
    }

    if (line.startsWith("#")) {
      if (paragraphLines.length > 0) break;
      continue;
    }

    if (line.startsWith("```")) {
      if (paragraphLines.length > 0) break;
      continue;
    }

    if (
      line.startsWith("- ") ||
      line.startsWith("* ") ||
      line.startsWith("1. ")
    ) {
      if (paragraphLines.length > 0) break;
      continue;
    }

    paragraphLines.push(line);
  }

  return paragraphLines.join(" ").trim();
}

async function readMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readMarkdownFiles(entryPath);
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        return [entryPath];
      }
      return [];
    }),
  );

  return results.flat();
}

function compareDocItems(left: DocNavItem, right: DocNavItem): number {
  if (left.order !== null || right.order !== null) {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
  }

  return left.title.localeCompare(right.title);
}

function compareTreeNodes(left: DocNavTreeNode, right: DocNavTreeNode): number {
  if (left.order !== null || right.order !== null) {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
  }

  return left.title.localeCompare(right.title);
}

function getFolderTitle(folderPath: string): string {
  const folderName = folderPath.split("/").filter(Boolean).pop() ?? folderPath;
  return titleCaseSegment(folderName);
}

function folderOrder(node: DocNavTreeNode): number | null {
  if (node.index?.order !== null && node.index?.order !== undefined) {
    return node.index.order;
  }

  const childOrders = [
    ...node.pages,
    ...node.folders.flatMap((folder) => [folder.index, ...folder.pages]),
  ]
    .filter((item): item is DocNavItem => item !== null && item.order !== null)
    .map((item) => item.order as number);

  if (childOrders.length === 0) return null;
  return Math.min(...childOrders);
}

function buildDocNavTree(items: DocNavItem[]): DocNavTreeNode[] {
  const folderNodes = new Map<string, DocNavTreeNode>();

  function ensureFolderNode(folderPath: string): DocNavTreeNode {
    const existing = folderNodes.get(folderPath);
    if (existing) return existing;

    const node: DocNavTreeNode = {
      title: getFolderTitle(folderPath),
      description: "",
      slug: null,
      path: folderPath,
      index: null,
      pages: [],
      folders: [],
      clickable: false,
      order: null,
    };

    folderNodes.set(folderPath, node);

    const parentPath = folderPath.includes("/")
      ? folderPath.slice(0, folderPath.lastIndexOf("/"))
      : "";

    if (parentPath !== "") {
      const parentNode = ensureFolderNode(parentPath);
      parentNode.folders.push(node);
    }

    return node;
  }

  for (const item of items) {
    const folderPath = item.folderPath;
    if (folderPath) {
      const folderNode = ensureFolderNode(folderPath);
      if (item.isIndex) {
        folderNode.index = item;
        folderNode.title = item.title;
        folderNode.description = item.description;
        folderNode.slug = item.slug || null;
        folderNode.clickable = item.isRenderable;
      } else {
        if (item.isRenderable) {
          folderNode.pages.push(item);
        }
      }
      continue;
    }
  }

  for (const node of folderNodes.values()) {
    node.pages.sort(compareDocItems);
    node.folders.sort(compareTreeNodes);
    node.order = folderOrder(node);
  }

  const rootNodes = [
    ...items
      .filter((item) => !item.folderPath && item.isRenderable)
      .map(
        (item) =>
          ({
            title: item.title,
            description: item.description,
            slug: item.slug,
            path: item.slug,
            index: item,
            pages: [],
            folders: [],
            clickable: true,
            order: item.order,
          }) satisfies DocNavTreeNode,
      ),
    ...[...folderNodes.entries()]
      .filter(([folderPath]) => folderPath !== "" && !folderPath.includes("/"))
      .map(([, node]) => node),
  ];

  return rootNodes.sort(compareTreeNodes);
}

export async function getDocNavItems(): Promise<DocNavItem[]> {
  const filePaths = await readMarkdownFiles(DOC_ROOT);
  const items = await Promise.all(
    filePaths.map(async (filePath) => {
      const relativePath = path.relative(DOC_ROOT, filePath);
      const slug = routeSlugFromRelativePath(relativePath);
      const markdown = await fs.readFile(filePath, "utf8");
      const { frontmatter, body } = parseFrontmatter(markdown);
      const title = extractTitle(markdown, displayTitleFromSlug(slug));
      const description =
        extractDescription(markdown) || `Documentation page for ${title}`;
      const searchText = [title, description, body].join(" ").replace(/\s+/g, " ").trim();

      return {
        slug,
        title,
        description,
        searchText,
        relativePath,
        fileName: fileNameFromRelativePath(relativePath),
        isIndex: path.basename(relativePath).toLowerCase() === "index.md",
        folderPath: folderPathFromRelativePath(relativePath),
        hasContent: body.trim().length > 0,
        isRenderable:
          body.trim().length > 0 || frontmatter.title !== undefined || frontmatter.description !== undefined,
        order: frontmatter.order ?? null,
      } satisfies DocNavItem;
    }),
  );

  return items.sort(compareDocItems);
}

export async function getDocNavTree(): Promise<DocNavTreeNode[]> {
  const items = await getDocNavItems();
  return buildDocNavTree(items);
}

export async function getDocBySlug(slug: string) {
  const items = await getDocNavItems();
  const normalizedSlug = normalizeDocSlug(slug);
  return (
    items.find(
      (item) =>
        item.isRenderable && normalizeDocSlug(item.slug) === normalizedSlug,
    ) ?? null
  );
}

export async function getDocMarkdown(slug: string) {
  const doc = await getDocBySlug(slug);
  if (!doc) return null;

  const filePath = path.join(DOC_ROOT, doc.relativePath);
  const markdown = await fs.readFile(filePath, "utf8");
  const { body } = parseFrontmatter(markdown);

  return {
    doc,
    markdown: body,
  };
}

export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shouldIncludeHeading(text: string): boolean {
  if (/^`[^`]+`$/.test(text)) {
    return false;
  }

  return true;
}

export function extractDocHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      const text = h2Match[1].trim();
      if (!shouldIncludeHeading(text)) continue;
      headings.push({ id: slugifyHeading(text), text, level: 2 });
      continue;
    }

    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      const text = h3Match[1].trim();
      if (!shouldIncludeHeading(text)) continue;
      headings.push({ id: slugifyHeading(text), text, level: 3 });
    }
  }

  return headings;
}
