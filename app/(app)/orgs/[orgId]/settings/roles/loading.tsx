import { Skeleton } from "@/components/ui/skeleton";

export default function RolesLoading() {
  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="-mx-4 -mt-4 mb-0 border-b bg-card px-4 py-2 flex items-center justify-between gap-2 sm:-mx-6 sm:-mt-6 sm:px-6">
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-7 w-24 rounded-md" />
      </div>

      {/* Roles list */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
          >
            <Skeleton className="h-4 w-4 rounded-full shrink-0" />
            <Skeleton className="h-4 w-32 rounded flex-1" />
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-6 w-6 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
