"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { RegisterPageSidebar } from "@/components/layout/contexts/page-sidebar-context";

function SidebarSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Nav items */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-12 flex items-center gap-3 px-4 border-b border-border/40 shrink-0"
        >
          <Skeleton className="h-5 w-5 rounded shrink-0" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/**
 * Shared loading skeleton for all tool pages (hub, conversion, item-list, roster).
 * Registers a skeleton sidebar so the panel stays open and populated during loading.
 */
export function ToolPageSkeleton() {
  return (
    <>
      <RegisterPageSidebar content={<SidebarSkeleton />} />

      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="shrink-0 -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 h-12 px-4 sm:px-6 border-b border-border flex items-center gap-3">
          <Skeleton className="h-7 w-44 rounded-md" />
          <Skeleton className="ml-auto h-7 w-20 rounded-md" />
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 pt-6">
          <Skeleton className="h-4 w-28" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border p-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
