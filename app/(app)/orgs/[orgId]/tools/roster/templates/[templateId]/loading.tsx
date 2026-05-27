import { Skeleton } from "@/components/ui/skeleton";

export default function RosterTemplateEditorLoading() {
  return (
    <div className="flex flex-col gap-4" style={{ height: "calc(100dvh - 148px)" }}>
      {/* Toolbar */}
      <div className="-mx-4 -mt-4 mb-4 h-12 border-b bg-card px-4 flex items-center justify-between gap-2 sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6">
        <Skeleton className="h-5 w-24 rounded" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24 rounded-md" />
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      </div>

      {/* Day nav bar */}
      <Skeleton className="h-10 w-full rounded-lg" />

      {/* Grid area */}
      <div className="flex-1 min-h-0 rounded-lg border bg-card overflow-hidden flex flex-col">
        <div
          className="grid border-b"
          style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}
        >
          <div className="border-r" />
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
        <div className="flex-1 overflow-hidden">
          <div className="flex h-full">
            <div className="w-12 shrink-0 flex flex-col">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 flex items-start justify-end pr-2 pt-1"
                >
                  <Skeleton className="h-2.5 w-6 rounded" />
                </div>
              ))}
            </div>
            <div className="flex-1 grid grid-cols-7">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="border-r last:border-r-0 h-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
