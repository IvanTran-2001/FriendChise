"use client";

import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { AnnouncementActions } from "./announcement-actions";

export type AnnouncementOrder = "newest" | "oldest";

function buildListHref(orgId: string, order: AnnouncementOrder) {
  const params = new URLSearchParams();
  if (order === "oldest") params.set("order", order);
  const query = params.toString();
  return query ? `/orgs/${orgId}/announcements?${query}` : `/orgs/${orgId}/announcements`;
}

export function AnnouncementSidebarContent({
  orgId,
  order,
  canManage,
}: {
  orgId: string;
  order: AnnouncementOrder;
  canManage: boolean;
}) {
  const router = useRouter();

  function setOrder(nextOrder: AnnouncementOrder) {
    router.replace(buildListHref(orgId, nextOrder));
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
      <div className="px-3 pt-2.5 pb-3 border-t border-border">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          Order
        </p>
        {/* Everyone can change sort order, but only owners get the actions block. */}
        <SegmentedControl
          options={[
            { label: "Newest", value: "newest" },
            { label: "Oldest", value: "oldest" },
          ]}
          value={order}
          onChange={(value) => setOrder(value as AnnouncementOrder)}
          size="default"
        />
      </div>

      {canManage && (
        <div className="px-3 pt-2 pb-3 border-t border-border">
          <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
            Actions
          </p>
          <AnnouncementActions orgId={orgId} canManage={canManage} />
        </div>
      )}
    </div>
  );
}