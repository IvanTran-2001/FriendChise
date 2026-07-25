/**
 * JoinPage — server wrapper for the franchise join flow (`/orgs/join`).
 *
 * Passes the full timezone list to `JoinFranchisePage` at build time to avoid
 * loading it on the client. Wrapped in `<Suspense>` because the client
 * component calls `useSearchParams()` to read the `?token=` query param.
 *
 * When a `?token=` is present, the parent org's schedule is fetched and
 * forwarded as `defaultSchedule` so the form fields are pre-filled.
 */
import { Suspense } from "react";
import { TIMEZONES } from "@/lib/core/timezones";
import { prisma } from "@/lib/platform/prisma";
import JoinFranchisePage from "./join-franchise-client";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  let defaultSchedule:
    | {
        timezone?: string;
        address?: string | null;
        openTimeMin?: number | null;
        closeTimeMin?: number | null;
        operatingDays?: string[];
      }
    | undefined;

  if (token) {
    const ft = await prisma.franchiseToken.findUnique({
      where: { token },
      select: {
        organization: {
          select: {
            timezone: true,
            address: true,
            openTimeMin: true,
            closeTimeMin: true,
            operatingDays: true,
          },
        },
      },
    });
    if (ft?.organization) {
      defaultSchedule = ft.organization;
    }
  }

  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto mt-12 pb-16">
          <div className="rounded-xl border bg-card p-6 shadow-sm h-125" />
        </div>
      }
    >
      <JoinFranchisePage
        timezones={TIMEZONES}
        defaultSchedule={defaultSchedule}
      />
    </Suspense>
  );
}
