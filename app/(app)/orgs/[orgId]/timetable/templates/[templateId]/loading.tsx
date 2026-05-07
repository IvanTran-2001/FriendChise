import { Skeleton } from "@/components/ui/skeleton";

export default function TemplateEditorLoading() {
  return (
    <div
      className="flex flex-col gap-4"
      style={{ height: "calc(100dvh - 148px)" }}
    >
      {/* Toolbar */}
      <div className="-mx-4 -mt-4 mb-4 h-12 border-b bg-card px-4 flex items-center justify-between gap-2 sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6">
        <Skeleton className="h-5 w-24 rounded" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>

      {/* Day nav bar */}
      <Skeleton className="h-10 w-full rounded-lg" />

      {/* Grid area */}
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 rounded-lg border bg-card overflow-hidden flex flex-col">
          <div
            className="grid border-b"
            style={{ gridTemplateColumns: `48px repeat(7, 1fr)` }}
          >
            <div className="border-r" />
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center py-2 gap-1 border-r last:border-r-0"
              >
                <Skeleton className="h-2.5 w-6 rounded" />
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-hidden relative">
            <div className="h-full flex">
              <div className="w-12 shrink-0">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="border-b" style={{ height: 150 }}>
                    <div className="pt-1 pl-1">
                      <Skeleton className="h-2.5 w-7 rounded" />
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="flex-1 grid"
                style={{ gridTemplateColumns: "repeat(7, 1fr)" }}
              >
                {Array.from({ length: 7 }).map((_, col) => (
                  <div key={col} className="border-r last:border-r-0 relative">
                    {col % 2 === 0 && (
                      <div className="absolute inset-x-1 top-[25%]">
                        <Skeleton className="h-14 w-full rounded-md" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Task panel */}
        <div className="w-52 rounded-lg border bg-card p-3 space-y-2 shrink-0">
          <Skeleton className="h-4 w-20 rounded" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
