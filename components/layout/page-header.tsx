"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

/**
 * Maps URL path segments to human-readable breadcrumb labels.
 * Add an entry here whenever a new route segment is introduced.
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
};

interface BreadcrumbItem {
  label: string;
  /** When set, the crumb renders as a clickable link. The last crumb never has an href. */
  href?: string;
}

/**
 * Renders a purple breadcrumb bar that automatically reflects the current route.
 * Placed in the app layout so every page gets it without any per-page setup.
 *
 * Breadcrumb logic:
 * - Outside an org (no `orgId` param): only shown on specific standalone pages e.g. /orgs/new.
 * - Inside an org: always starts with "Overview" (the org root), then appends one crumb
 *   per additional URL segment. All crumbs except the last are rendered as links.
 * - Returns null (renders nothing) on pages that don't need a breadcrumb bar, e.g. home.
 */
export function PageHeader() {
  // Current URL path, e.g. "/orgs/abc123/tasks/new"
  const pathname = usePathname();
  // Dynamic route params — orgId is present on any /orgs/[orgId]/... page
  const { orgId } = useParams<{ orgId?: string }>();

  const breadcrumbs: BreadcrumbItem[] = [];

  if (!orgId) {
    // Non-org pages — only add a crumb for known standalone routes
    if (pathname === "/orgs/new") {
      breadcrumbs.push({ label: "Create Organization" });
    }
  } else {
    const base = `/orgs/${orgId}`;

    // "Overview" is always the root crumb for any org page
    breadcrumbs.push({ label: "Overview", href: base });

    // Strip the org base path and split the remainder into segments
    // e.g. "/orgs/abc/tasks/new" → ["tasks", "new"]
    const rest = pathname.slice(base.length).replace(/^\//, "");
    const segments = rest ? rest.split("/") : [];

    segments.forEach((seg, i) => {
      const label = SEGMENT_LABELS[seg] ?? seg;
      const isLast = i === segments.length - 1;
      // Intermediate crumbs get a href so they're navigable; the last crumb does not
      const href = isLast
        ? undefined
        : `${base}/${segments.slice(0, i + 1).join("/")}`;
      breadcrumbs.push({ label, href });
    });
  }

  // No crumbs means this page doesn't need a header bar — render nothing
  if (breadcrumbs.length === 0) return null;

  return (
    <div className="bg-primary px-6 py-3">
      <nav className="flex items-center gap-1.5 text-primary-foreground text-sm">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="opacity-50">/</span>}
              {!isLast && crumb.href ? (
                <Link
                  href={crumb.href}
                  className="opacity-75 hover:opacity-100 transition-opacity"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className={isLast ? "font-semibold" : "opacity-75"}>
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
