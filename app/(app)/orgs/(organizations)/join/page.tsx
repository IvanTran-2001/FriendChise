/**
 * JoinPage — server wrapper for the franchise join flow (`/orgs/join`).
 *
 * Passes the full timezone list to `JoinFranchisePage` at build time to avoid
 * loading it on the client. Wrapped in `<Suspense>` because the client
 * component calls `useSearchParams()` to read the `?token=` query param.
 */
import { Suspense } from "react";
import { TIMEZONES } from "@/lib/timezones";
import JoinFranchisePage from "./join-franchise-client";

export default function Page() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto mt-12 pb-16"><div className="rounded-xl border bg-card p-6 shadow-sm h-[500px]" /></div>}>
      <JoinFranchisePage timezones={TIMEZONES} />
    </Suspense>
  );
}
