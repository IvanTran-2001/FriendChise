import { Suspense } from "react";
import { UnauthorizedToast } from "./unauthorized-toast";

/**
 * Org-scoped layout.
 *
 * Wraps all /orgs/[orgId]/** pages with the UnauthorizedToast component so any
 * redirect that appends ?unauthorized=1 shows feedback regardless of which
 * sub-page the user lands on.
 */
export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <UnauthorizedToast />
      </Suspense>
      {children}
    </>
  );
}
