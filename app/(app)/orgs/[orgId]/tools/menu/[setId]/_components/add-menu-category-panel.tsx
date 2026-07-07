"use client";

/**
 * Add menu category panel.
 * Small action-sidebar form for creating a new menu tab/category with an
 * optional description.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createMenuTabAction } from "@/app/actions/tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddMenuCategoryPanel({
  orgId,
  menuId,
  onClose,
}: {
  orgId: string;
  menuId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    startTransition(async () => {
      const result = await createMenuTabAction(
        orgId,
        menuId,
        trimmedName,
        description.trim() || undefined,
      );
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to create category.");
        return;
      }
      toast.success(`"${trimmedName}" created.`);
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="menu-category-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="menu-category-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Breakfast"
          required
          autoFocus
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="menu-category-description" className="text-sm font-medium">
          Description
        </label>
        <Input
          id="menu-category-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          disabled={isPending}
        />
      </div>

      <Button type="submit" disabled={isPending || !name.trim()} className="w-full">
        {isPending ? "Creating…" : "Create Category"}
      </Button>
    </form>
  );
}