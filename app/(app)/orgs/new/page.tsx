import { Suspense } from "react";
import NewOrgPage from "./new-org-client";

export default function Page() {
  return (
    <Suspense>
      <NewOrgPage />
    </Suspense>
  );
}
