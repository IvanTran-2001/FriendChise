/**
 * AddSetForm — action sidebar panel for creating a new ConversionSet.
 *
 * On submit, calls `createConversionSetAction` which also auto-creates a
 * "Default" template for the set. Calls `onSuccess` on completion so the
 * sidebar can close or refresh.
 */
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createConversionSetAction } from "@/app/actions/tools";

interface AddSetFormProps {
  orgId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddSetForm({ orgId, onSuccess, onCancel }: AddSetFormProps) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    startTransition(async () => {
      const result = await createConversionSetAction(orgId, trimmedName);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to create set.");
        return;
      }
      toast.success(`"${trimmedName}" created.`);
      onSuccess();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="set-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="set-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Donut Production"
          required
          autoFocus
          disabled={isPending}
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isPending}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending || !name.trim()}
          className="flex-1"
        >
          Save
        </Button>
      </div>
    </form>
  );
}
