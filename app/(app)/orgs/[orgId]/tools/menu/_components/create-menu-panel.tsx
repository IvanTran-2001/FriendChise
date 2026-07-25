"use client";

/**
 * Create menu panel.
 * Minimal action-sidebar form for creating a new menu with a name and
 * optional description.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createMenuAction } from "@/app/actions/tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CreatedMenu = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: Date;
  _count: { tabs: number; items: number };
};

export function CreateMenuPanel({
  orgId,
  onCreated,
  onClose,
}: {
  orgId: string;
  onCreated: (menu: CreatedMenu) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createMenuAction(orgId, name, description);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to create menu.");
        return;
      }
      toast.success(`"${result.menu.name}" created.`);
      onCreated(result.menu);
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-menu-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="new-menu-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Breakfast Menu"
          required
          autoFocus
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-menu-description" className="text-sm font-medium">
          Description
        </label>
        <Input
          id="new-menu-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional short description"
          disabled={isPending}
        />
      </div>

      <Button type="submit" disabled={isPending || !name.trim()} className="w-full">
        {isPending ? "Creating…" : "Create Menu"}
      </Button>
    </form>
  );
}