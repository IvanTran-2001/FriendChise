/**
 * Pathname resolver for demo tour configs.
 *
 * This file discovers route-specific demo tour configs from the route tree,
 * normalizes App Router file paths into URL paths, and resolves the config
 * that should be shown for the current pathname.
 */
import type { DemoTourConfig } from "./types";

export const STORAGE_KEY_PREFIX = "friendchise-demo-tour-dismissed";

type DemoTourRouteModule = {
  demoTourConfig: DemoTourConfig | null;
};

type DemoTourRouteEntry = {
  key: string;
  exactPath: string | null;
  pattern: RegExp;
  config: DemoTourConfig | null;
};

type WebpackRequireContext = {
  keys(): string[];
  <T>(path: string): T;
};

// Escapes a route segment so it can be used safely inside a regular expression.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Converts a webpack context key like `./orgs/[orgId]/index.ts` into `orgs/[orgId]`.
function normalizeContextKey(key: string): string {
  const normalized = key.replace(/^\.\//, "");
  if (normalized === "index.ts" || normalized === "index.tsx") return "";
  return normalized.replace(/\/index\.(ts|tsx)$/, "");
}

// Turns a discovered file path into the route pathname used by `usePathname()`.
function routePathFromKey(key: string): string {
  const normalized = normalizeContextKey(key);
  return normalized ? `/${normalized}` : "/";
}

// Builds a pathname matcher for static and dynamic routes.
function routePatternFromKey(key: string): RegExp {
  const normalized = normalizeContextKey(key);
  if (!normalized) return /^\/$/;

  const pattern = normalized
    .split("/")
    .map((segment) => {
      if (segment.startsWith("[...") && segment.endsWith("]")) {
        return ".+";
      }

      if (segment.startsWith("[") && segment.endsWith("]")) {
        return "[^/]+";
      }

      return escapeRegExp(segment);
    })
    .join("/");

  return new RegExp(`^/${pattern}/?$`);
}

// Dynamic segments like `[orgId]` should match any single path segment.
function isDynamicRouteKey(key: string): boolean {
  return normalizeContextKey(key)
    .split("/")
    .some((segment) => segment.startsWith("[") && segment.endsWith("]"));
}

function getRouteSpecificityScore(key: string) {
  const segments = normalizeContextKey(key).split("/").filter(Boolean);

  let staticSegmentCount = 0;
  let dynamicSegmentCount = 0;

  for (const segment of segments) {
    if (segment.startsWith("[") && segment.endsWith("]")) {
      dynamicSegmentCount += 1;
      continue;
    }

    staticSegmentCount += 1;
  }

  return {
    staticSegmentCount,
    dynamicSegmentCount,
    segmentCount: segments.length,
  };
}

function compareRouteSpecificity(a: DemoTourRouteEntry, b: DemoTourRouteEntry): number {
  const aScore = getRouteSpecificityScore(a.key);
  const bScore = getRouteSpecificityScore(b.key);

  return (
    bScore.staticSegmentCount - aScore.staticSegmentCount ||
    aScore.dynamicSegmentCount - bScore.dynamicSegmentCount ||
    bScore.segmentCount - aScore.segmentCount ||
    a.key.localeCompare(b.key)
  );
}

// Scan the demo-tour route tree and collect every `index.ts` / `index.tsx`
// file under `components/layout/demo-tour/routes`.
const routeModules = (require as unknown as { context: (...args: unknown[]) => WebpackRequireContext }).context(
  "./routes",
  true,
  /index\.(ts|tsx)$/,
);

// Convert each discovered route module into a lookup entry that knows both the
// exact pathname and the regex pattern for dynamic routes.
const DEMO_TOUR_ROUTE_ENTRIES: DemoTourRouteEntry[] = routeModules.keys().map((key) => {
  const routeModule = routeModules<DemoTourRouteModule>(key);
  return {
    key,
    exactPath: isDynamicRouteKey(key) ? null : routePathFromKey(key),
    pattern: routePatternFromKey(key),
    config: routeModule.demoTourConfig,
  };
});

const DEMO_TOUR_DYNAMIC_ROUTE_ENTRIES = DEMO_TOUR_ROUTE_ENTRIES.filter((entry) => entry.exactPath === null).sort(
  compareRouteSpecificity,
);

// Fast exact-match lookup for static paths like `/` or `/orgs/new`.
const DEMO_TOUR_EXACT_PATH_CONFIGS = new Map<string, DemoTourConfig | null>();
for (const entry of DEMO_TOUR_ROUTE_ENTRIES) {
  if (entry.exactPath !== null) {
    DEMO_TOUR_EXACT_PATH_CONFIGS.set(entry.exactPath, entry.config);
  }
}

// Resolve the demo-tour config for the current pathname.
//
// Exact static routes win first. If no exact match exists, dynamic route
// patterns are checked next. A config of `null` means the route exists but the
// demo tour should intentionally not mount there.
export function getDemoTourConfig(pathname: string): DemoTourConfig | null {
  const exactPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

  if (DEMO_TOUR_EXACT_PATH_CONFIGS.has(exactPath)) {
    return DEMO_TOUR_EXACT_PATH_CONFIGS.get(exactPath) ?? null;
  }

  for (const entry of DEMO_TOUR_DYNAMIC_ROUTE_ENTRIES) {
    if (entry.exactPath) continue;
    if (entry.config === null) continue;
    if (entry.pattern.test(pathname)) {
      return entry.config;
    }
  }

  return null;
}
