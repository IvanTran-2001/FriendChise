import { Skeleton } from "@/components/ui/skeleton";

export function TaskListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden shadow-sm divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          {/* Color bar */}
          <Skeleton className="w-1 h-10 rounded-full shrink-0" />
          {/* Thumbnail placeholder */}
          <Skeleton className="w-9 h-9 rounded-md shrink-0 hidden sm:block" />
          {/* Text */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <Skeleton className="h-4 w-2/5 rounded" />
            <Skeleton className="h-3 w-3/5 rounded" />
          </div>
          {/* Badges */}
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TaskCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {/* Cover image area */}
          <Skeleton className="w-full h-36 rounded-none" />
          <div className="p-4 flex flex-col gap-3">
            <Skeleton className="h-4 w-3/5 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-4/5 rounded" />
            <div className="flex gap-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
          <div className="px-3 py-2 border-t flex gap-2">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
