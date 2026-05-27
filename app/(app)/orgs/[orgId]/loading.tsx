import { Skeleton } from "@/components/ui/skeleton";

export default function OrgOverviewLoading() {
  return (
    <div className="max-w-3xl mx-auto w-full rounded-2xl border bg-card shadow-sm">
      {/* Accent bar */}
      <Skeleton className="h-1.5 rounded-t-2xl rounded-b-none w-full" />

      <div className="p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-48 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
          </div>
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-2"
            >
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-7 w-10 rounded-md mt-1" />
              <Skeleton className="h-3 w-14 rounded-md" />
            </div>
          ))}
        </div>

        {/* Roster feature card */}
        <div className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4 shadow-sm mb-8">
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <Skeleton className="h-3.5 w-16 rounded" />
            <Skeleton className="h-3 w-40 rounded" />
          </div>
        </div>

        {/* Recent Tools */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
          <div className="rounded-xl border divide-y overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-3.5 w-3.5 rounded shrink-0" />
                <Skeleton className="h-3.5 flex-1 rounded" />
                <Skeleton className="h-3 w-12 rounded shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Today's schedule */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-3.5 w-32 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          <div className="rounded-xl border divide-y overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="w-2.5 h-2.5 rounded-full shrink-0" />
                <Skeleton className="h-3.5 w-12 rounded shrink-0" />
                <Skeleton className="h-4 flex-1 rounded-md" />
                <Skeleton className="h-3.5 w-12 rounded shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
