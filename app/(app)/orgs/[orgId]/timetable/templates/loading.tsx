import { Skeleton } from "@/components/ui/skeleton";

export default function TemplatesLoading() {
  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="-mx-4 -mt-4 mb-0 border-b bg-card px-4 py-2 flex items-center justify-between gap-2 sm:-mx-6 sm:-mt-6 sm:px-6">
        <Skeleton className="h-5 w-24 rounded" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24 rounded-md" />
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      </div>

      {/* Template cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card shadow-sm p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-5 w-36 rounded" />
              <Skeleton className="h-6 w-6 rounded-md shrink-0" />
            </div>
            <Skeleton className="h-3.5 w-24 rounded" />
            <div className="flex gap-1 pt-1">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-5 w-9 rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
