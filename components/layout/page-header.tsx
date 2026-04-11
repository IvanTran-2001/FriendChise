import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

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

interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** Returns true if a segment looks like a DB id rather than a known keyword. */
function looksLikeId(seg: string): boolean {
  return seg.length > 8 && /^[a-z0-9]+$/i.test(seg) && !(seg in SEGMENT_LABELS);
}

/**
 * Resolves a URL segment to a human-readable label.
 * For known keywords it uses SEGMENT_LABELS; for id-like segments it
 * queries the DB using the preceding segment as a type hint.
 */
async function resolveLabel(
  seg: string,
  index: number,
  segments: string[],
  orgId: string | null,
): Promise<string> {
  if (seg in SEGMENT_LABELS) return SEGMENT_LABELS[seg];
  if (!looksLikeId(seg)) return seg;

  const parent = index > 0 ? segments[index - 1] : null;

  try {
    if (parent === "tasks") {
      const t = await prisma.task.findFirst({
        where: { id: seg, orgId: orgId ?? undefined },
        select: { name: true },
      });
      if (t) return t.name;
    } else if (parent === "memberships" && orgId) {
      const m = await prisma.membership.findFirst({
        where: { orgId, id: seg },
        select: { user: { select: { name: true } } },
      });
      if (m?.user?.name) return m.user.name;
    } else if (parent === "roles") {
      const r = await prisma.role.findFirst({
        where: { id: seg, orgId: orgId ?? undefined },
        select: { name: true },
      });
      if (r) return r.name;
    } else if (parent === "templates") {
      const t = await prisma.template.findFirst({
        where: { id: seg, orgId: orgId ?? undefined },
        select: { name: true },
      });
      if (t) return t.name;
    }
  } catch {
    // DB unavailable — fall back to raw id
  }

  return seg;
}

/**
 * Renders a purple breadcrumb bar that automatically reflects the current route.
 *
 * Async server component: reads the current pathname from the `x-pathname`
 * request header (set by the middleware in proxy.ts) and resolves any
 * dynamic id segments to entity names via direct Prisma queries.
 */
export async function PageHeader() {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  const breadcrumbs: BreadcrumbItem[] = [];

  const orgMatch = pathname.match(/^\/orgs\/([^/]+)(\/.*)?$/);

  if (!orgMatch || orgMatch[1] === "new") {
    if (pathname === "/orgs/new") {
      breadcrumbs.push({ label: "Create Organization" });
    }
  } else {
    const orgId = orgMatch[1];
    const base = `/orgs/${orgId}`;

    breadcrumbs.push({ label: "Overview", href: base });

    const rest = (orgMatch[2] ?? "").replace(/^\//, "");
    const segments = rest ? rest.split("/") : [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const label = await resolveLabel(seg, i, segments, orgId);
      const isLast = i === segments.length - 1;
      const href = isLast
        ? undefined
        : `${base}/${segments.slice(0, i + 1).join("/")}`;
      breadcrumbs.push({ label, href });
    }
  }

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
