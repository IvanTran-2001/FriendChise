"use client";

import { X } from "lucide-react";

interface PlacementStatusBannerProps {
  title: string;
  itemName: string;
  message: string;
  onCancel: () => void;
}

export function PlacementStatusBanner({ title, itemName, message, onCancel }: PlacementStatusBannerProps) {
  return (
    <div className="mb-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <div className="mt-0.5 h-3.5 w-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <div className="min-w-0">
            <div className="truncate font-medium">
              {title} &ldquo;{itemName}&rdquo;
            </div>
            <div className="mt-0.5 text-xs text-primary/75">{message}</div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-background/60 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-background"
          aria-label="Cancel placement"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}