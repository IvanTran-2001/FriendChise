import { notFound } from "next/navigation";
import { requireOrgPermissionPage } from "@/lib/authz";
import { PermissionAction } from "@prisma/client";
import { RegisterPageSidebar } from "@/components/layout/contexts/page-sidebar-context";
import { prisma } from "@/lib/platform/prisma";
import { createSignedReadUrls } from "@/lib/platform/supabase-storage";
import {
  getConversionSet,
  getConversionRates,
  getConversionTemplates,
  getTemplateEntries,
  getToolItemLists,
} from "@/lib/services/tools";
import {
  RECENT_ACTIVITY_CATEGORY,
  recordRecentActivity,
} from "@/lib/services/recent-activity";
import { SetSidebarContent } from "./_components/set-sidebar-content";
import { SetDetailClient } from "./set-detail-client";

export default async function ConversionSetPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; setId: string }>;
  searchParams: Promise<{ template?: string; t?: string; view?: string }>;
}) {
  const { orgId, setId } = await params;
  const { template: templateParam, t: tParam, view: viewParam } = await searchParams;
  const view = viewParam === "list" ? "list" : "card";
  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);

  const [set, rates, lists] = await Promise.all([
    getConversionSet(orgId, setId),
    getConversionRates(orgId, setId),
    getToolItemLists(orgId),
  ]);

  if (!set) notFound();

  void recordRecentActivity({
    orgId,
    category: RECENT_ACTIVITY_CATEGORY.TOOLS,
    entityKey: set.id,
    entityName: set.name,
    entityHref: `/orgs/${orgId}/tools/conversion/${set.id}`,
  }).catch((err) => {
    console.error("Failed to record recent activity:", err);
  });

  // Ensure every set has a "Default" template
  await prisma.conversionTemplate.upsert({
    where: { setId_name: { setId, name: "Default" } },
    create: { setId, name: "Default" },
    update: {},
  });

  const templates = await getConversionTemplates(orgId, setId);

  // Sign item images from rates
  const itemImgPaths = [
    ...new Set(
      rates.flatMap((r) => [
        ...(r.fromItem.imgUrl ? [r.fromItem.imgUrl] : []),
        ...(r.toItem.imgUrl ? [r.toItem.imgUrl] : []),
      ]),
    ),
  ];
  const signedImgUrls = await createSignedReadUrls(itemImgPaths);
  const itemImages = new Map(
    rates.flatMap((r) => [
      [r.fromItem.id, r.fromItem.imgUrl ? (signedImgUrls.get(r.fromItem.imgUrl) ?? null) : null],
      [r.toItem.id, r.toItem.imgUrl ? (signedImgUrls.get(r.toItem.imgUrl) ?? null) : null],
    ]),
  );

  // Resolve active template: URL param → Default → first
  const activeTemplateId =
    templates.find((t) => t.id === templateParam)?.id ??
    templates.find((t) => t.name === "Default")?.id ??
    templates[0]?.id ??
    null;

  const initialEntries = activeTemplateId
    ? await getTemplateEntries(orgId, activeTemplateId)
    : [];

  return (
    <>
      <RegisterPageSidebar
        title={set.name}
        content={
          <SetSidebarContent
            orgId={orgId}
            setId={setId}
            setName={set.name}
            rates={rates}
            templates={templates}
            lists={lists.map((l) => ({ id: l.id, name: l.name }))}
            activeTemplateId={activeTemplateId}
            view={view}
          />
        }
      />
      <SetDetailClient
        key={`${activeTemplateId ?? "none"}-${tParam ?? ""}`}
        orgId={orgId}
        set={set}
        rates={rates}
        templates={templates}
        activeTemplateId={activeTemplateId}
        initialEntries={initialEntries}
        view={view}
        itemImages={Object.fromEntries(itemImages)}
      />
    </>
  );
}
