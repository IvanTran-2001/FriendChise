import { Skeleton } from "@/components/ui/skeleton";
import { RegisterPageSidebar, RegisterPageSidebarSubContent } from "@/components/layout/contexts/page-sidebar-context";
import { ItemListSidebarShell } from "../_components/item-list-sidebar-shell";

function ListsSidebarSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4">
      <Skeleton className="h-8 w-full rounded-md" />
      <div className="flex flex-col gap-1 pt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

export default function ItemListsLoading() {
  return (
    <>
      <RegisterPageSidebar title="Item List" content={<ItemListSidebarShell />} />
      <RegisterPageSidebarSubContent content={<ListsSidebarSkeleton />} />

      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="shrink-0 -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 h-12 px-4 sm:px-6 border-b border-border flex items-center gap-3">
          <Skeleton className="h-7 w-48 rounded-md" />
          <Skeleton className="ml-auto h-7 w-24 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>

        {/* List rows */}
        <div className="flex flex-col gap-0 pt-6 rounded-lg border overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
            >
              <Skeleton className="h-9 w-9 rounded-md shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
