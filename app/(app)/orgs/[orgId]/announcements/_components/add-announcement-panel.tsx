"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
import { type AnnouncementScope } from "@prisma/client";
import {
  createAnnouncementAction,
  type AnnouncementMutationState,
  updateAnnouncementAction,
} from "@/app/actions/announcements";

type AnnouncementFormAnnouncement = {
  id: string;
  title: string;
  description: string;
  scope: AnnouncementScope;
  expiresAt: Date | string | null;
};

const initialState: AnnouncementMutationState = null;

function getDefaultExpiresAtValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateTimeLocal(date: Date | string | null | undefined) {
  if (!date) return "";
  const value = date instanceof Date ? date : new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function AddAnnouncementPanel({
  orgId,
  mode = "create",
  announcement,
}: {
  orgId: string;
  mode?: "create" | "edit";
  announcement?: AnnouncementFormAnnouncement | null;
}) {
  const { close } = useActionSidebar();
  const router = useRouter();
  const boundAction =
    mode === "edit" && announcement
      ? updateAnnouncementAction.bind(null, orgId, announcement.id)
      : createAnnouncementAction.bind(null, orgId);
  const [state, dispatch, pending] = useActionState<AnnouncementMutationState, FormData>(
    boundAction,
    initialState,
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      toast.error(state.error ?? "Something went wrong");
      return;
    }
    toast.success(mode === "edit" ? "Announcement updated." : "Announcement created.");
    router.refresh();
    close();
  }, [state, close, mode, router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const expiresAtRaw = formData.get("expiresAt");
    if (expiresAtRaw && typeof expiresAtRaw === "string" && expiresAtRaw.trim()) {
      const localDate = new Date(expiresAtRaw);
      if (!Number.isNaN(localDate.getTime())) {
        formData.set("expiresAt", localDate.toISOString());
      }
    }
    startTransition(() => dispatch(formData));
  }

  const titleValue = announcement?.title ?? "";
  const descriptionValue = announcement?.description ?? "";
  const scopeValue = (announcement?.scope ?? "ORG") as AnnouncementScope;
  const expiresAtValue = announcement?.expiresAt
    ? formatDateTimeLocal(announcement.expiresAt)
    : mode === "create"
      ? getDefaultExpiresAtValue()
      : "";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Title <span className="text-destructive">*</span>
        </label>
        <Input
          id="title"
          name="title"
          type="text"
          required
          placeholder="e.g. New shift process"
          autoFocus
          defaultValue={titleValue}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          Description <span className="text-destructive">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={6}
          placeholder="Write the announcement details here..."
          defaultValue={descriptionValue}
          className="min-h-28 w-full rounded-none border border-input bg-background px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="scope" className="text-sm font-medium">
            Visibility
          </label>
          <select
            id="scope"
            name="scope"
            defaultValue={scopeValue}
            className="h-8 w-full rounded-none border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="ORG">Org only</option>
            <option value="GLOBAL">Shared</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="expiresAt" className="text-sm font-medium">
            Expires at
          </label>
          <Input
            id="expiresAt"
            name="expiresAt"
            type="datetime-local"
            defaultValue={expiresAtValue}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted-foreground">
          Announcements are visible immediately after saving.
        </p>
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? (mode === "edit" ? "Saving…" : "Publishing…") : mode === "edit" ? "Save changes" : "Publish"}
        </Button>
      </div>
    </form>
  );
}