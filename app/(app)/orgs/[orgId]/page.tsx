import { redirect } from "next/navigation";
import { requireOrgMemberPage } from "@/lib/authz";

// TODO: remove redirect when overview page is implemented
const Page = async ({ params }: { params: Promise<{ orgId: string }> }) => {
  const { orgId } = await params;
  await requireOrgMemberPage(orgId);
  redirect(`/orgs/${orgId}/timetable`);
};

export default Page;
