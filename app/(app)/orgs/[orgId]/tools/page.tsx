import { requireOrgPermissionPage } from "@/lib/authz";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { PermissionAction } from "@prisma/client";
import { getConversionSets } from "@/lib/services/tools";
import { hasRosterActivity } from "@/lib/services/roster";
import {
  listRecentActivitiesByCategories,
  RECENT_ACTIVITY_CATEGORY,
  type RecentActivityRecord,
} from "@/lib/services/recent-activity";
import { ToolsSidebarContent } from "./_components/tools-sidebar-content";
import { ToolsClient } from "./tools-client";

export default async function ToolsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);

  const [recentActivity, hasRoster, fallbackSets] = await Promise.all([
    listRecentActivitiesByCategories(
      orgId,
      [RECENT_ACTIVITY_CATEGORY.TOOLS, RECENT_ACTIVITY_CATEGORY.ITEM_LISTS],
      5,
    ),
    hasRosterActivity(orgId),
    getConversionSets(orgId),
  ]);

  const typedRecentActivity: RecentActivityRecord[] = recentActivity;
  const recentSets: Array<{ id: string; name: string; updatedAt: Date; category: string; href: string }> =
    typedRecentActivity.length > 0
      ? typedRecentActivity.map((item: RecentActivityRecord) => ({
          id: item.entityKey,
          name: item.entityName,
          updatedAt: item.lastUsedAt,
          category: item.category,
          href: item.entityHref ?? (item.category === 'item-list' ? `/orgs/${orgId}/tools/item-lists/${item.entityKey}` : `/orgs/${orgId}/tools/conversion/${item.entityKey}`),
        }))
      : fallbackSets.slice(0, 5).map((set: (typeof fallbackSets)[number]) => ({
          id: set.id,
          name: set.name,
          updatedAt: set.updatedAt,
          category: RECENT_ACTIVITY_CATEGORY.TOOLS,
          href: `/orgs/${orgId}/tools/conversion/${set.id}`,
        }));

  return (
    <>
      <RegisterPageSidebar title="Tools" content={<ToolsSidebarContent orgId={orgId} />} />
      <ToolsClient
        orgId={orgId}
        recentSets={recentSets}
        hasRoster={hasRoster}
      />
    </>
  );
}
