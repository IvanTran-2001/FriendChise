import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireOrgPermissionPage } from "@/lib/authz";
import { PermissionAction } from "@prisma/client";
import { CreateTemplateForm } from "./create-template-form";

export default async function NewTemplatePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);

  return (
    <div className="max-w-lg mx-auto">
      <Link
        href={`/orgs/${orgId}/timetable/templates`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Templates
      </Link>
      <h1 className="text-xl font-semibold mb-6">New Template</h1>
      <CreateTemplateForm orgId={orgId} />
    </div>
  );
}
