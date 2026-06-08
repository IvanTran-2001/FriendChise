import { getRoles } from "@/lib/services/roles";
import { getOrgTags } from "@/lib/services/tags";
import { requireOrgMemberPage } from "@/lib/authz";
import {
  getOrgMembership,
  memberHasPermission,
  getAuthUserId,
} from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import { cookies } from "next/headers";

import { TasksPageClient } from "./_components/tasks-page-client";
import { SORT_OPTIONS, type SortOption } from "./_components/tasks-config";

/**
 * Tasks list page — server component.
 *
 * Guards access with `requireOrgMemberPage`; redirects to `/` if the caller is not
 * a member. Fetches the relevant task set based on `mode`, then renders the
 * interactive TaskTable client component with search, sort, and filter.
 *
 * Three display modes (driven by the `?mode` URL param):
 *  - `shared`    (default) — tasks the org has inherited via TaskInheritance,
 *                            plus GLOBAL tasks from the franchise not yet inherited
 *  - `list`      — only tasks the org has inherited (its active task library)
 *  - `available` — only GLOBAL franchise tasks not yet inherited (discover & add)
 *
 * Sort, role filter, tag filter, and view (list/card) are additional URL params
 * so the sidebar controls and the table stay in sync without client state sharing.
 * The last-used mode/prefs are persisted to cookies (server-readable) so they can
 * be restored via a server-side redirect before the page renders, avoiding the
 * client-side localStorage round-trip on first load.
 */
const VALID_SORT_VALUES = SORT_OPTIONS.map((o) => o.value);

const TasksPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{
    sort?: string;
    roleId?: string;
    view?: string;
    tagId?: string;
    mode?: string;
  }>;
}) => {
  const { orgId } = await params;
  const sp = await searchParams;
  const isModeExplicit =
    sp.mode === "shared" || sp.mode === "list" || sp.mode === "available";
  const isFiltersExplicit = !!(sp.sort || sp.roleId || sp.view || sp.tagId);

  await requireOrgMemberPage(orgId);

  // ── Cookie-based mode default ───────────────────────────────────────────────
  // Read the saved mode from the cookie and use it as the server-side default so
  // the page renders with the correct view on bare navigation — no redirect needed.
  // sort/roleId/tagId/view are kept URL-only; the client mount effect handles their
  // restoration to avoid a "stuck filter" when the user explicitly clears them.
  const cookieStore = await cookies();
  const savedMode = cookieStore.get(`tasks-mode-${orgId}`)?.value;
  const mode: "list" | "shared" | "available" =
    sp.mode === "list"
      ? "list"
      : sp.mode === "available"
        ? "available"
        : sp.mode === "shared"
          ? "shared"
          : savedMode === "list"
            ? "list"
            : savedMode === "available"
              ? "available"
              : "shared";
  // Also read view/sort/roleId/tagId from the prefs cookie as server-side defaults.
  // Safe because every control that can change these writes the cookie synchronously
  // BEFORE calling router.push, so the cookie is always current on the next request.
  let savedPrefs: { sort?: string; view?: string; roleId?: string | null; tagId?: string | null } | null = null;
  const rawPrefsCookie = cookieStore.get(`tasks-prefs-${orgId}`)?.value;
  if (rawPrefsCookie) {
    try { savedPrefs = JSON.parse(decodeURIComponent(rawPrefsCookie)); } catch { /* ignore */ }
  }
  // ──────────────────────────────────────────────────────────────────────────


  const userId = await getAuthUserId();
  const membership = userId ? await getOrgMembership(orgId, userId) : null;
  const canManageTasks = membership
    ? await memberHasPermission(
        membership.id,
        orgId,
        PermissionAction.MANAGE_TASKS,
      )
    : false;

  const [roles, orgTags] = await Promise.all([
    getRoles(orgId),
    getOrgTags(orgId),
  ]);

  const sort: SortOption = VALID_SORT_VALUES.includes(sp.sort as SortOption)
    ? (sp.sort as SortOption)
    : VALID_SORT_VALUES.includes(savedPrefs?.sort as SortOption)
      ? (savedPrefs!.sort as SortOption)
      : "name-asc";
  const roleId =
    typeof sp.roleId === "string" && roles.some((r) => r.id === sp.roleId)
      ? sp.roleId
      : typeof savedPrefs?.roleId === "string" && roles.some((r) => r.id === savedPrefs!.roleId)
        ? (savedPrefs!.roleId as string)
        : null;
  const view: "list" | "card" =
    sp.view === "card" ? "card" :
    sp.view === "list" ? "list" :
    savedPrefs?.view === "card" ? "card" : "list";

  const tags = orgTags.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  const tagId =
    typeof sp.tagId === "string" && tags.some((t) => t.id === sp.tagId)
      ? sp.tagId
      : typeof savedPrefs?.tagId === "string" && tags.some((t) => t.id === savedPrefs!.tagId)
        ? (savedPrefs!.tagId as string)
        : null;

  return (
    <TasksPageClient
      orgId={orgId}
      roles={roles}
      tags={tags}
      canManageTasks={canManageTasks}
      sort={sort}
      roleId={roleId}
      tagId={tagId}
      view={view}
      mode={mode}
      isModeExplicit={isModeExplicit}
      isFiltersExplicit={isFiltersExplicit}
    />
  );
};

export default TasksPage;
