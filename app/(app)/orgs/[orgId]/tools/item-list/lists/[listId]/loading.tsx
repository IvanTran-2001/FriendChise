import { Skeleton } from "@/components/ui/skeleton";
import { RegisterPageSidebar, RegisterPageSidebarSubContent } from "@/components/layout/contexts/page-sidebar-context";
import { ItemListSidebarShell } from "../../_components/item-list-sidebar-shell";

function ListDetailSidebarSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* View toggle */}
      <Skeleton className="h-8 w-full rounded-md" />

      {/* Add item button */}
      <Skeleton className="h-8 w-full rounded-md" />

      {/* Grid size section */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-16" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-md shrink-0" />
          <Skeleton className="h-7 flex-1 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md shrink-0" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-md shrink-0" />
          <Skeleton className="h-7 flex-1 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md shrink-0" />
        </div>
      </div>

      {/* Apply rates section */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    </div>
  );
}

function ListDetailContentSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="shrink-0 -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 h-12 px-4 sm:px-6 border-b border-border flex items-center gap-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="ml-auto h-7 w-20 rounded-md" />
      </div>

      {/* Grid cells */}
      <div className="grid grid-cols-4 gap-2 pt-6">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border p-2 flex flex-col gap-2 aspect-square"
          >
            <Skeleton className="h-full w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ListDetailLoading() {
  return (
    <>
      <RegisterPageSidebar title="Item List" content={<ItemListSidebarShell />} />
      <RegisterPageSidebarSubContent content={<ListDetailSidebarSkeleton />} />
      <ListDetailContentSkeleton />
    </>
  );
}
