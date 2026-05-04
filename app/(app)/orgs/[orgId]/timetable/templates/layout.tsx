import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionPage } from "@/lib/authz";

/**
 * Layout guard for all timetable template subroutes.
 *
 * Any request to /orgs/[orgId]/timetable/templates/** is blocked here if the
 * caller doesn't hold MANAGE_TIMETABLE. Individual pages (list, new, editor)
 * don't need to repeat this check.
 *
 * The sidebar shell (nav tabs) is registered by the parent timetable/layout.tsx
 * and persists across all timetable routes.
 */
export default async function TemplatesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TIMETABLE, {
    redirectTo: `/orgs/${orgId}/timetable`,
  });
  return <>{children}</>;
}
