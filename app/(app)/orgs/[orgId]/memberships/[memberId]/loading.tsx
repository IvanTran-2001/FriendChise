import { Skeleton } from "@/components/ui/skeleton";

export default function MemberDetailLoading() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Toolbar */}
      <div className="-mx-4 -mt-4 mb-4 h-12 border-b bg-card px-4 flex items-center justify-between gap-2 sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6">
        <Skeleton className="h-5 w-20 rounded" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>

      {/* Profile card */}
      <div className="rounded-xl border bg-card shadow-sm p-6 flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
      </div>

      {/* Detail rows */}
      <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-4 w-28 rounded shrink-0" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
