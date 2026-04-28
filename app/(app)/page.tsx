import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OrgNotFoundToast } from "./org-not-found-toast";

// TODO: remove redirect when workspace page is implemented
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ orgNotFound?: string }>;
}) {
  const { orgNotFound } = await searchParams;

  // Keep the org-not-found toast flow intact; only redirect on clean visits
  if (!orgNotFound) {
    redirect("/orgs/new");
  }

  return (
    <div>
      <Suspense>
        <OrgNotFoundToast />
      </Suspense>
    </div>
  );
}
