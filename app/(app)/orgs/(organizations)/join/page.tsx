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
