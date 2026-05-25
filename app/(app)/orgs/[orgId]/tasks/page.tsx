import { getInheritedTasks, getSharedTasks } from "@/lib/services/tasks";
import { getRoles } from "@/lib/services/roles";
import { createSignedReadUrl } from "@/lib/supabase-storage";
import { getOrgTags } from "@/lib/services/tags";
import { requireOrgMemberPage } from "@/lib/authz";
import {
  getOrgMembership,
  memberHasPermission,
  getAuthUserId,
} from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { TaskTable } from "./_components/task-table";
import { TasksSidebarContent } from "./_components/tasks-sidebar-content";
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
  const mode: "list" | "shared" | "available" =
    sp.mode === "list"
      ? "list"
      : sp.mode === "available"
        ? "available"
        : "shared";
  const isFiltersExplicit = !!(sp.sort || sp.roleId || sp.view || sp.tagId);

  await requireOrgMemberPage(orgId);

  // ── Restore prefs from cookies before any data fetch ──────────────────────
  // Cookies are readable server-side, so we can redirect to the correct URL
  // immediately instead of letting the client read localStorage and re-render.
  if (!isModeExplicit || !isFiltersExplicit) {
    const cookieStore = await cookies();
    const urlParams = new URLSearchParams();
    let needsRedirect = false;

    // Keep any params that are already explicit in the URL
    if (isModeExplicit && sp.mode) urlParams.set("mode", sp.mode);
    if (sp.sort) urlParams.set("sort", sp.sort);
    if (sp.roleId) urlParams.set("roleId", sp.roleId);
    if (sp.tagId) urlParams.set("tagId", sp.tagId);
    if (sp.view) urlParams.set("view", sp.view);

    if (!isModeExplicit) {
      const saved = cookieStore.get(`tasks-mode-${orgId}`)?.value;
      if (saved === "list" || saved === "available") {
        urlParams.set("mode", saved);
        needsRedirect = true;
      }
    }

    if (!isFiltersExplicit) {
      try {
        const raw = cookieStore.get(`tasks-prefs-${orgId}`)?.value;
        const prefs = raw ? (JSON.parse(decodeURIComponent(raw)) as Record<string, string>) : null;
        if (prefs) {
          if (prefs.sort && VALID_SORT_VALUES.includes(prefs.sort as SortOption) && prefs.sort !== "name-asc") {
            urlParams.set("sort", prefs.sort);
            needsRedirect = true;
          }
          if (prefs.roleId) { urlParams.set("roleId", prefs.roleId); needsRedirect = true; }
          if (prefs.tagId) { urlParams.set("tagId", prefs.tagId); needsRedirect = true; }
          if (prefs.view === "card") { urlParams.set("view", prefs.view); needsRedirect = true; }
        }
      } catch { /* ignore malformed cookie */ }
    }

    if (needsRedirect) {
      const qs = urlParams.toString();
      redirect(`/orgs/${orgId}/tasks${qs ? `?${qs}` : ""}`);
    }
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

  const [tasks, roles, orgTags] = await Promise.all([
    mode === "shared"
      ? Promise.all([getInheritedTasks(orgId), getSharedTasks(orgId)]).then(
          ([inherited, shared]) => [
            ...inherited.map((t) => ({ ...t, _available: false as const })),
            ...shared.map((t) => ({ ...t, _available: true as const })),
          ],
        )
      : mode === "available"
        ? getSharedTasks(orgId).then((shared) =>
            shared.map((t) => ({ ...t, _available: true as const })),
          )
        : getInheritedTasks(orgId).then((inherited) =>
            inherited.map((t) => ({ ...t, _available: false as const })),
          ),
    getRoles(orgId),
    getOrgTags(orgId),
  ]);

  const sort: SortOption = VALID_SORT_VALUES.includes(sp.sort as SortOption)
    ? (sp.sort as SortOption)
    : "name-asc";
  const roleId =
    typeof sp.roleId === "string" && roles.some((r) => r.id === sp.roleId)
      ? sp.roleId
      : null;
  const view: "list" | "card" = sp.view === "card" ? "card" : "list";

  // Resolve signed image URLs only when images will be displayed (not in list view)
  const tasksWithImages =
    view !== "list"
      ? await Promise.all(
          tasks.map(async (t) => ({
            ...t,
            imageSignedUrl: t.imageUrl
              ? await createSignedReadUrl(t.imageUrl)
              : null,
          })),
        )
      : tasks.map((t) => ({ ...t, imageSignedUrl: null }));

  const tags = orgTags.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  const tagId =
    typeof sp.tagId === "string" && tags.some((t) => t.id === sp.tagId)
      ? sp.tagId
      : null;

  return (
    <>
      <RegisterPageSidebarSubContent
        content={
          <TasksSidebarContent
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
        }
      />
      <TaskTable
        orgId={orgId}
        tasks={tasksWithImages}
        canManageTasks={canManageTasks}
        sort={sort}
        filterRoleId={roleId}
        filterTagId={tagId}
        view={view}
      />
    </>
  );
};

export default TasksPage;
