"use client";

/**
 * Edit menu panel.
 * Reuses the same field layout as the create form so menu edits stay in the
 * action sidebar without leaving the list page.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateMenuAction } from "@/app/actions/tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EditableMenu = {
  id: string;
  name: string;
  description: string | null;
};

export function EditMenuPanel({
  orgId,
  menu,
  onClose,
}: {
  orgId: string;
  menu: EditableMenu;
  onClose: () => void;
}) {
  const [name, setName] = useState(menu.name);
  const [description, setDescription] = useState(menu.description ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateMenuAction(orgId, menu.id, name, description);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to update menu.");
        return;
      }
      toast.success("Menu updated.");
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="menu-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="menu-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="menu-description" className="text-sm font-medium">
          Description
        </label>
        <Input
          id="menu-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
        />
      </div>

      <Button type="submit" disabled={isPending || !name.trim()} className="w-full">
        {isPending ? "Saving…" : "Save Menu"}
      </Button>
    </form>
  );
}