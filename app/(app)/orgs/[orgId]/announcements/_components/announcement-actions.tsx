"use client";

import { useRef } from "react";
import { Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { AddAnnouncementPanel } from "./add-announcement-panel";

export function AnnouncementActions({
  orgId,
  canManage,
}: {
  orgId: string;
  canManage: boolean;
}) {
  const { open, activeTitle } = useActionSidebar();
  const panelKeyRef = useRef(0);

  // Keep the create action hidden unless the org owner is viewing the page.
  if (!canManage) return null;

  function openAddAnnouncement() {
    const key = ++panelKeyRef.current;
    open(
      "Add Announcement",
      <AddAnnouncementPanel key={key} orgId={orgId} mode="create" />,
    );
  }

  return (
    <Button
      variant={activeTitle === "Add Announcement" ? "default" : "outline"}
      size="sm"
      className="w-full justify-start gap-2"
      onClick={openAddAnnouncement}
    >
      <Megaphone className="h-4 w-4 shrink-0" />
      Make announcement
      <Plus className="ml-auto h-3.5 w-3.5 shrink-0 opacity-70" />
    </Button>
  );
}