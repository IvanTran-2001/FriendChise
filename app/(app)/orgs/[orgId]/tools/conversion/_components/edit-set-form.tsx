/**
 * EditSetForm — action sidebar panel for editing a ConversionSet.
 *
 * Two sections:
 *   1. **Rename** — updates the set name in place; save button disabled when
 *      the name is unchanged.
 *   2. **Delete** — destroys the set and all its rates/templates via DB cascade;
 *      redirects back to the conversion list via `router.refresh()`.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  renameConversionSetAction,
  deleteConversionSetAction,
} from "@/app/actions/tools";

interface EditSetFormProps {
  orgId: string;
  set: { id: string; name: string };
  onClose: () => void;
}

export function EditSetForm({ orgId, set, onClose }: EditSetFormProps) {
  const router = useRouter();
  const [name, setName] = useState(set.name);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  function handleRename(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await renameConversionSetAction(orgId, set.id, name);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to rename set.");
        return;
      }
      toast.success("Set renamed.");
      onClose();
      router.refresh();
    });
  }

  function handleDelete() {
    setIsDeleting(true);
    startTransition(async () => {
      const result = await deleteConversionSetAction(orgId, set.id);
      if (!result.ok) {
        toast.error("Failed to delete set.");
        setIsDeleting(false);
        return;
      }
      toast.success(`"${set.name}" deleted.`);
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Rename */}
      <form onSubmit={handleRename} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="set-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="set-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            disabled={isPending}
          />
        </div>
        <Button
          type="submit"
          disabled={isPending || !name.trim() || name.trim() === set.name}
          className="w-full"
        >
          Save
        </Button>
      </form>

      <hr className="border-border" />

      {/* Delete */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          Deleting a set also removes all its rates and templates.
        </p>
        <Button
          variant="destructive"
          className="w-full gap-2"
          disabled={isPending}
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? "Deleting…" : "Delete Set"}
        </Button>
      </div>
    </div>
  );
}
