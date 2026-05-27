import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationSettingsLoading() {
  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <div className="rounded-lg border bg-card shadow-sm p-6 space-y-4">
        <Skeleton className="h-3.5 w-40 rounded" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-48 rounded flex-1" />
              <Skeleton className="h-5 w-10 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
