import { requireOrgPermissionPage } from "@/lib/authz";
import { getTimetableTemplates } from "@/lib/services/templates";
import { PermissionAction } from "@prisma/client";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { TemplatesSidebarContent } from "./_components/templates-sidebar-content";
import { TemplatesClient } from "./templates-client";

export default async function TemplatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const view: "card" | "list" = sp.view === "list" ? "list" : "card";

  const templateHref = (v: "card" | "list") => {
    const qs = v === "card" ? "" : `?view=${v}`;
    return `/orgs/${orgId}/timetable/templates${qs}`;
  };

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TIMETABLE, {
    redirectTo: `/orgs/${orgId}/timetable`,
  });

  const templates = await getTimetableTemplates(orgId);

  return (
    <>
      <RegisterPageSidebarSubContent
        content={
          <TemplatesSidebarContent
            orgId={orgId}
            view={view}
            listHref={templateHref("list")}
            cardHref={templateHref("card")}
          />
        }
      />
      <TemplatesClient orgId={orgId} templates={templates} view={view} />
    </>
  );
}
