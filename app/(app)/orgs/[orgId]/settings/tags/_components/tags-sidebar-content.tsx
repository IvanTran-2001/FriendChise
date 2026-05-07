"use client";

import { useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMobileSidebar } from "@/components/layout/mobile-sidebar-context";
import { CreateTagForm } from "./tag-form";

export function TagsSidebarContent({
  orgId,
  allTasks,
}: {
  orgId: string;
  allTasks: { id: string; name: string; color: string }[];
}) {
  const { open, activeTitle } = useActionSidebar();
  const isMobile = useIsMobile();
  const { setOpen: setMobileSidebarOpen } = useMobileSidebar();
  const formKeyRef = useRef(0);

  function handleCreate() {
    const k = ++formKeyRef.current;
    open("New Tag", <CreateTagForm key={k} orgId={orgId} allTasks={allTasks} />);
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          Tags
        </span>
      </div>
      <div className="px-3 pt-3 pb-3">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          Actions
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant={activeTitle === "New Tag" ? "default" : "outline"}
            size="sm"
            onClick={handleCreate}
            className="w-full justify-start gap-2"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Add Tag
          </Button>
        </div>
      </div>
    </div>
  );
}
