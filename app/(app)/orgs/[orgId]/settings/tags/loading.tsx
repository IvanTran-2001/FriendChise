"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";

function TagsSidebarSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3">
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
      <div className="flex flex-col gap-1 px-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 h-8">
            <Skeleton className="h-3 w-3 rounded-full shrink-0" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TagsLoading() {
  return (
    <>
      <RegisterPageSidebar content={<TagsSidebarSkeleton />} />
      <div className="flex flex-col gap-4">
        <div className="-mx-4 -mt-4 mb-4 h-12 border-b bg-card px-4 flex items-center justify-between gap-2 sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6">
          <Skeleton className="h-5 w-16 rounded" />
          <Skeleton className="h-7 w-24 rounded-md" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      </div>
    </>
  );
}
