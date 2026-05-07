import { Suspense } from "react";
import { UnauthorizedToast } from "./unauthorized-toast";
import { RecordLastOrg } from "./record-last-org";

/**
 * Org-scoped layout.
 *
 * Wraps all /orgs/[orgId]/** pages with the UnauthorizedToast component so any
 * redirect that appends ?unauthorized=1 shows feedback regardless of which
 * sub-page the user lands on.
 */
export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return (
    <>
      <RecordLastOrg orgId={orgId} />
      <Suspense>
        <UnauthorizedToast />
      </Suspense>
      {children}
    </>
  );
}
