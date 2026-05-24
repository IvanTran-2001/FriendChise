import { notFound } from "next/navigation";
import { requireOrgMemberPage } from "@/lib/authz";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { prisma } from "@/lib/prisma";
import {
  getConversionSet,
  getToolItems,
  getConversionRates,
  getConversionTemplates,
  getTemplateEntries,
} from "@/lib/services/tools";
import { SetSidebarContent } from "./_components/set-sidebar-content";
import { SetDetailClient } from "./set-detail-client";

export default async function ConversionSetPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; setId: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { orgId, setId } = await params;
  const { template: templateParam } = await searchParams;
  await requireOrgMemberPage(orgId);

  const [set, toolItems, rates] = await Promise.all([
    getConversionSet(orgId, setId),
    getToolItems(orgId),
    getConversionRates(orgId, setId),
  ]);

  if (!set) notFound();

  // Ensure every set has a "Default" template
  await prisma.conversionTemplate.upsert({
    where: { setId_name: { setId, name: "Default" } },
    create: { setId, name: "Default" },
    update: {},
  });

  const templates = await getConversionTemplates(orgId, setId);

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
        content={
          <SetSidebarContent
            orgId={orgId}
            setId={setId}
            setName={set.name}
            toolItems={toolItems}
            rates={rates}
            templates={templates}
          />
        }
      />
      <SetDetailClient
        key={activeTemplateId ?? "none"}
        orgId={orgId}
        set={set}
        rates={rates}
        templates={templates}
        activeTemplateId={activeTemplateId}
        initialEntries={initialEntries}
      />
    </>
  );
}
