import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { requireOrgMemberPage } from "@/lib/authz";
import {
  getOrgMembership,
  memberHasPermission,
} from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import { getToolItemListDetail, getToolItemsFull, getConversionSets, getConversionRates } from "@/lib/services/tools";
import { createSignedReadUrls } from "@/lib/supabase-storage";
import {
  RECENT_ACTIVITY_CATEGORY,
  recordRecentActivity,
} from "@/lib/services/recent-activity";
import {
  RegisterPageSidebar,
} from "@/components/layout/page-sidebar-context";
import { ItemListSidebarShell } from "../../_components/item-list-sidebar-shell";
import { ListDetailClient, type ListDetail } from "./_components/list-detail-client";

export default async function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; listId: string }>;
  searchParams: Promise<{ view?: string; set?: string }>;
}) {
  const { orgId, listId } = await params;
  const { view: viewParam, set: setParam } = await searchParams;

  const { userId } = await requireOrgMemberPage(orgId);

  // Restore last-used conversion set from cookie when URL has no ?set= param
  const cookieStore = await cookies();
  const rawRatesPref = cookieStore.get(`item-list-rates-prefs-${orgId}`)?.value;
  let savedSetId: string | null = null;
  if (rawRatesPref) {
    try { savedSetId = (JSON.parse(decodeURIComponent(rawRatesPref)) as { setId?: string | null }).setId ?? null; } catch { /* ignore */ }
  }
  const effectiveSetParam = setParam ?? savedSetId ?? undefined;

  const [list, allOrgItems, conversionSets] = await Promise.all([
    getToolItemListDetail(listId, orgId),
    getToolItemsFull(orgId),
    getConversionSets(orgId),
  ]);
  if (!list) notFound();

  const activeSetId = conversionSets.find((s) => s.id === effectiveSetParam)?.id ?? null;
  const activeSetName = conversionSets.find((s) => s.id === activeSetId)?.name ?? null;
  const activeSetRates = activeSetId ? await getConversionRates(orgId, activeSetId) : [];

  // Default to the list's configured display type
  const defaultView = list.displayType === "CHECKLIST" ? "checklist" : "grid";
  const view: "grid" | "checklist" =
    viewParam === "checklist"
      ? "checklist"
      : viewParam === "grid"
        ? "grid"
        : defaultView;

  const membership = userId ? await getOrgMembership(orgId, userId) : null;
  const canManage = membership
    ? await memberHasPermission(
        membership.id,
        orgId,
        PermissionAction.MANAGE_TASKS,
      )
    : false;

  void recordRecentActivity({
    orgId,
    category: RECENT_ACTIVITY_CATEGORY.ITEM_LISTS,
    entityKey: list.id,
    entityName: list.name,
    entityHref: `/orgs/${orgId}/tools/item-list/lists/${list.id}`,
  }).catch((err) => {
    console.error("Failed to record recent activity:", err);
  });

  const imagePaths = allOrgItems.map((i) => i.imgUrl).filter((p): p is string => !!p);
  const entryImagePaths = list.entries.map((e) => e.item.imgUrl).filter((p): p is string => !!p);
  const allPaths = [...new Set([...imagePaths, ...entryImagePaths])];
  const signedMap = allPaths.length > 0 ? await createSignedReadUrls(allPaths) : new Map<string, string | null>();

  const allItems = allOrgItems.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    imgUrl: i.imgUrl,
    imageSignedUrl: i.imgUrl ? (signedMap.get(i.imgUrl) ?? null) : null,
  }));

  const listWithSignedUrls: ListDetail = {
    ...list,
    displayType: list.displayType as ListDetail["displayType"],
    entries: list.entries.map((e) => ({
      ...e,
      item: {
        id: e.item.id,
        name: e.item.name,
        unit: e.item.unit,
        imgUrl: e.item.imgUrl,
        imageSignedUrl: e.item.imgUrl ? (signedMap.get(e.item.imgUrl) ?? null) : null,
      },
    })),
  };

  return (
    <>
      <RegisterPageSidebar title="Item List" content={<ItemListSidebarShell />} />
      <ListDetailClient
        orgId={orgId}
        list={listWithSignedUrls}
        view={view}
        canManage={canManage}
        allOrgItems={allItems}
        activeSetId={activeSetId}
        activeSetName={activeSetName}
        activeSetRates={activeSetRates}
        conversionSets={conversionSets.map((s) => ({ id: s.id, name: s.name }))}
      />
    </>
  );
}
