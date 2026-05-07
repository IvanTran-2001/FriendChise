import { Skeleton } from "@/components/ui/skeleton";

export default function TaskDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="-mx-4 -mt-4 mb-4 h-12 border-b bg-card px-4 flex items-center justify-between gap-2 sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6">
        <Skeleton className="h-5 w-20 rounded" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      </div>

      {/* Detail card */}
      <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4 max-w-2xl">
        <Skeleton className="h-6 w-48 rounded" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-4 w-28 rounded shrink-0" />
              <Skeleton className="h-4 w-40 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Roles section */}
      <div className="space-y-2 max-w-2xl">
        <Skeleton className="h-4 w-24 rounded" />
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
