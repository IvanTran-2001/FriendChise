import { Skeleton } from "@/components/ui/skeleton";

export default function TimetableLoading() {
  return (
    <div
      className="flex flex-col gap-4"
      style={{ height: "calc(100dvh - 148px)", minHeight: "500px" }}
    >
      {/* Toolbar skeleton */}
      <div className="-mx-4 -mt-4 mb-4 h-12 border-b bg-card px-4 flex items-center justify-between gap-2 sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-28 rounded-md" />
        </div>
        <Skeleton className="h-7 w-24 rounded-md" />
      </div>

      {/* Week nav bar */}
      <Skeleton className="h-10 w-full rounded-lg" />

      {/* Grid area */}
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 rounded-lg border bg-card overflow-hidden flex flex-col">
          {/* Column headers */}
          <div className="grid grid-cols-7 border-b">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center py-2 gap-1 border-r last:border-r-0"
              >
                <Skeleton className="h-2.5 w-6 rounded" />
                <Skeleton className="h-7 w-7 rounded-full" />
              </div>
            ))}
          </div>
          {/* Hour rows */}
          <div className="flex-1 overflow-hidden">
            <div className="flex h-full">
              <div className="w-12 shrink-0 flex flex-col">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 border-b flex items-start pt-1 px-1"
                  >
                    <Skeleton className="h-2.5 w-7 rounded" />
                  </div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7">
                {Array.from({ length: 7 }).map((_, col) => (
                  <div key={col} className="border-r last:border-r-0 relative">
                    {col === 0 && (
                      <div className="absolute inset-x-1 top-[30%]">
                        <Skeleton className="h-14 w-full rounded-md" />
                      </div>
                    )}
                    {col === 2 && (
                      <div className="absolute inset-x-1 top-[50%]">
                        <Skeleton className="h-10 w-full rounded-md" />
                      </div>
                    )}
                    {col === 4 && (
                      <div className="absolute inset-x-1 top-[20%]">
                        <Skeleton className="h-16 w-full rounded-md" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
