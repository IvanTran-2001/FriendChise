"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createNotePageAction } from "@/app/actions/tools/notes";

type NotePage = {
  id: string;
  title: string;
  content: string;
  position: number;
  orgId: string;
  createdAt: Date;
  updatedAt: Date;
};

interface CreatePagePanelProps {
  orgId: string;
  onCreated: (page: NotePage) => void;
  onClose: () => void;
}

export function CreatePagePanel({ orgId, onCreated, onClose }: CreatePagePanelProps) {
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    startTransition(async () => {
      const result = await createNotePageAction(orgId, title);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to create page.");
        return;
      }
      toast.success(`"${title.trim()}" created.`);
      onCreated(result.page);
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-page-title" className="text-sm font-medium">
          Page Title
        </label>
        <Input
          id="new-page-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Shopping List"
          required
          autoFocus
          disabled={isPending}
        />
      </div>

      <Button
        type="submit"
        disabled={isPending || !title.trim()}
        className="w-full"
      >
        {isPending ? "Creating…" : "Create Page"}
      </Button>
    </form>
  );
}
