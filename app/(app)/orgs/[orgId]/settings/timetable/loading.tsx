import { Skeleton } from "@/components/ui/skeleton";

export default function TimetableSettingsLoading() {
  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <div className="rounded-lg border bg-card shadow-sm p-6 space-y-4">
        <Skeleton className="h-3.5 w-36 rounded" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-36 rounded shrink-0" />
              <Skeleton className="h-8 w-48 rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="h-7 w-16 rounded-md" />
      </div>
    </div>
  );
}
