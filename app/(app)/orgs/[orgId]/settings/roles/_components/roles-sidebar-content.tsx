"use client";

/**
 * RolesSidebarContent — page sidebar for the roles settings page.
 *
 * Renders a "+ Create Role" button in the Actions section. Clicking it opens
 * `RoleForm` inside the `ActionSidebar` panel. On success the panel closes and
 * the page data is refreshed via `router.refresh()`. While the panel is open the
 * button highlights (filled variant) to indicate it is the active panel.
 *
 * Registered via `<RegisterPageSidebar>` in `roles/page.tsx`.
 */
import { useRef } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { RoleForm } from "./role-form";

export function RolesSidebarContent({
  orgId,
  tasks,
}: {
  orgId: string;
  tasks: { id: string; name: string }[];
}) {
  const { open, close, activeTitle } = useActionSidebar();
  const router = useRouter();
  const formKeyRef = useRef(0);

  function handleCreate() {
    const k = ++formKeyRef.current;
    open(
      "Create Role",
      <div key={k} className="p-4">
        <RoleForm
          orgId={orgId}
          tasks={tasks}
          onSuccess={() => {
            close();
            router.refresh();
          }}
          onCancel={close}
        />
      </div>,
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      <div className="px-3 pt-3 pb-3">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          Actions
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant={activeTitle === "Create Role" ? "default" : "outline"}
            size="sm"
            onClick={handleCreate}
            className="w-full justify-start gap-2"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Create Role
          </Button>
        </div>
      </div>
    </div>
  );
}
