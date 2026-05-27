import { Skeleton } from "@/components/ui/skeleton";

export default function OrgSettingsLoading() {
  return (
    <div className="space-y-6 p-6 max-w-2xl mx-auto">
      {/* Logo card */}
      <div className="rounded-lg border bg-card shadow-sm p-6 space-y-4">
        <Skeleton className="h-3.5 w-36 rounded" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-20 rounded-lg shrink-0" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-32 rounded-md" />
            <Skeleton className="h-3 w-40 rounded" />
          </div>
        </div>
      </div>

      {/* Location & Hours card */}
      <div className="rounded-lg border bg-card shadow-sm p-6 space-y-4">
        <Skeleton className="h-3.5 w-32 rounded" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-36 rounded shrink-0" />
              <Skeleton className="h-8 w-56 rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="h-7 w-16 rounded-md" />
      </div>

      {/* Transfer Ownership card */}
      <div className="rounded-lg border bg-card shadow-sm p-6 space-y-4">
        <Skeleton className="h-3.5 w-40 rounded" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-9 w-48 rounded-md" />
        </div>
        <Skeleton className="h-7 w-24 rounded-md" />
      </div>

      {/* Delete Org card */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 shadow-sm p-6 space-y-4">
        <Skeleton className="h-3.5 w-40 rounded" />
        <Skeleton className="h-12 w-full rounded-md" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-48 rounded" />
          <Skeleton className="h-8 w-40 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
