"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useBreadcrumbOverride } from "@/components/layout/breadcrumb-context";

/**
 * Maps static URL path segments to human-readable breadcrumb labels.
 */
const SEGMENT_LABELS: Record<string, string> = {
  timetable: "Timetable",
  tasks: "Tasks",
  memberships: "Members",
  progress: "Progress",
  settings: "Settings",
  organization: "Organization",
  roles: "Roles",
  notification: "Notification",
  new: "Create",
  edit: "Edit",
  templates: "Templates",
  franchisee: "Franchise",
};

/** Parent segment → entity-name API type */
const PARENT_TO_TYPE: Record<string, string> = {
  tasks: "tasks",
  memberships: "memberships",
  roles: "roles",
  templates: "templates",
};

interface BreadcrumbItem {
  label: string;
  href?: string;
  /** True while waiting for the entity name from the API */
  loading?: boolean;
}

/** Returns true when a segment looks like a DB id rather than a known keyword. */
function looksLikeId(seg: string): boolean {
  return (
    seg.length > 8 && /^[a-z0-9]+$/i.test(seg) && !(seg in SEGMENT_LABELS)
  );
}

/** Builds a static breadcrumb list from a pathname, using loading placeholders for IDs. */
function buildCrumbs(pathname: string): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [];

  const orgMatch = pathname.match(/^\/orgs\/([^/]+)(\/.*)?$/);
  if (!orgMatch || orgMatch[1] === "new") {
    if (pathname === "/orgs/new") breadcrumbs.push({ label: "Create Organization" });
    return breadcrumbs;
  }

  const orgId = orgMatch[1];
  const base = `/orgs/${orgId}`;
  breadcrumbs.push({ label: "Overview", href: base });

  const rest = (orgMatch[2] ?? "").replace(/^\//, "");
  const segments = rest ? rest.split("/") : [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    const href = isLast
      ? undefined
      : `${base}/${segments.slice(0, i + 1).join("/")}`;

    if (seg in SEGMENT_LABELS) {
      breadcrumbs.push({ label: SEGMENT_LABELS[seg], href });
    } else if (looksLikeId(seg)) {
      const parent = i > 0 ? segments[i - 1] : null;
      const isResolvable = !!(parent && parent in PARENT_TO_TYPE);
      breadcrumbs.push({ label: seg, href, loading: isResolvable });
    } else {
      breadcrumbs.push({ label: seg, href });
    }
  }

  return breadcrumbs;
}

/**
 * Client-side breadcrumb bar. Uses usePathname() so it automatically updates
 * on every client-side navigation. Entity names for dynamic ID segments are
 * resolved asynchronously from the /api/orgs/[orgId]/entity-name endpoint.
 */
export function PageHeader() {
  const pathname = usePathname();
  const { override } = useBreadcrumbOverride();

  const baseCrumbs = useMemo(() => buildCrumbs(pathname), [pathname]);

  // crumbIdx → resolved label, keyed by pathname so stale fetches from
  // previous routes never overwrite the current route's crumbs.
  const [resolvedByPath, setResolvedByPath] = useState<
    Record<string, Record<number, string>>
  >({});

  const crumbs = useMemo(() => {
    const resolved = resolvedByPath[pathname] ?? {};
    return baseCrumbs.map((c, idx) =>
      resolved[idx] === undefined
        ? c
        : { ...c, label: resolved[idx], loading: false },
    );
  }, [baseCrumbs, pathname, resolvedByPath]);

  useEffect(() => {
    const orgMatch = pathname.match(/^\/orgs\/([^/]+)(\/.*)?$/);
    if (!orgMatch || orgMatch[1] === "new") return;
    const orgId = orgMatch[1];
    const segments = (orgMatch[2] ?? "")
      .replace(/^\//, "")
      .split("/")
      .filter(Boolean);

    // Fetch names for all ID segments in parallel
    const controllers: AbortController[] = [];

    segments.forEach((seg, i) => {
      if (!looksLikeId(seg)) return;
      const parent = i > 0 ? segments[i - 1] : null;
      const type = parent ? PARENT_TO_TYPE[parent] : null;
      if (!type) return;

      const ctrl = new AbortController();
      controllers.push(ctrl);

      // Capture the crumb index (account for "Overview" at index 0)
      const crumbIdx = i + 1;

      fetch(
        `/api/orgs/${orgId}/entity-name?type=${encodeURIComponent(type)}&id=${encodeURIComponent(seg)}`,
        { signal: ctrl.signal },
      )
        .then((r) => {
          if (r.ok) return r.json();
          setResolvedByPath((prev) => ({
            ...prev,
            [pathname]: { ...(prev[pathname] ?? {}), [crumbIdx]: seg },
          }));
          return null;
        })
        .then((data: { name: string } | null) => {
          if (!data?.name) return;
          setResolvedByPath((prev) => ({
            ...prev,
            [pathname]: { ...(prev[pathname] ?? {}), [crumbIdx]: data.name },
          }));
        })
        .catch((error) => {
          if (error.name === "AbortError") return;
          setResolvedByPath((prev) => ({
            ...prev,
            [pathname]: { ...(prev[pathname] ?? {}), [crumbIdx]: seg },
          }));
        });
    });

    return () => controllers.forEach((c) => c.abort());
  }, [pathname]);

  if (baseCrumbs.length === 0) return null;

  return (
    <div className="border-b bg-card px-6 py-2.5">
      <nav className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          const label = isLast && override ? override : crumb.label;
          return (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-border select-none">/</span>}
              {!isLast && crumb.href ? (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {label}
                </Link>
              ) : (
                <span
                  className={
                    isLast
                      ? "text-primary font-semibold text-[0.9rem]"
                      : "text-muted-foreground"
                  }
                >
                  {crumb.loading ? (
                    <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-muted" />
                  ) : (
                    label
                  )}
                </span>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}