import { Suspense } from "react";
import { TIMEZONES } from "@/lib/timezones";
import NewOrgPage from "./new-org-client";

export default function Page() {
  return (
    <Suspense>
      <NewOrgPage timezones={TIMEZONES} />
    </Suspense>
  );
}
