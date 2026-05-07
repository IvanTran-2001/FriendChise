import { Skeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="-mx-4 -mt-4 mb-4 h-12 border-b bg-card px-4 flex items-center justify-between gap-2 sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-44 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24 rounded-md" />
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      </div>

      {/* Table rows */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-2.5 flex gap-6">
          {["w-32", "w-20", "w-24", "w-16"].map((w, i) => (
            <Skeleton key={i} className={`h-3.5 ${w} rounded`} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 px-4 py-3 border-b last:border-b-0"
          >
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-4 w-10 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
