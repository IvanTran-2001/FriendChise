import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionPage } from "@/lib/authz";

/**
 * Layout guard for all settings subroutes.
 *
 * Any request to /orgs/[orgId]/settings/** is blocked here if the caller
 * doesn't hold MANAGE_SETTINGS. This means future settings pages don't need
 * their own membership/permission boilerplate — they inherit this gate.
 *
 * The settings navigation lives in the AppSidebar (switches to settings mode
 * automatically when the route is under /settings).
 */
export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_SETTINGS, {
    redirectTo: `/orgs/${orgId}`,
  });
  return <>{children}</>;
}
