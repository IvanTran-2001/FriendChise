"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";

function RolesSidebarSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="p-3">
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    </div>
  );
}

export default function RolesLoading() {
  return (
    <>
      <RegisterPageSidebar content={<RolesSidebarSkeleton />} />
      <div className="max-w-3xl mx-auto w-full">
        {/* Roles list */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden overflow-x-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
            >
              <Skeleton className="h-4 w-4 rounded-full shrink-0" />
              <Skeleton className="h-4 w-32 rounded flex-1" />
              <div className="flex gap-1 flex-wrap">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-6 w-6 rounded-md shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
