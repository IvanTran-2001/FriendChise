"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { RegisterPageSidebarSubContent } from "@/components/layout/contexts/page-sidebar-context";

function SubContentSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-3 pt-3 pb-2">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-10" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full rounded-md" />
      ))}
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full rounded-md" />
      ))}
    </div>
  );
}

/**
 * Registers a skeleton into the page sidebar sub-content slot during loading.
 * Used in loading.tsx files for pages that use RegisterPageSidebarSubContent
 * (tasks, memberships, timetable) so the sidebar shell isn't blank while loading.
 */
export function SidebarSubContentSkeleton() {
  return <RegisterPageSidebarSubContent content={<SubContentSkeleton />} />;
}
