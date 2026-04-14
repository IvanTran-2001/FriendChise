import { requireOrgMemberPage } from "@/lib/authz";

/** Org overview page — placeholder for per-org summary content. */
const Page = async ({ params }: { params: Promise<{ orgId: string }> }) => {
  const { orgId } = await params;
  await requireOrgMemberPage(orgId);

  return <div>{/* Overview content */}</div>;
};

export default Page;
