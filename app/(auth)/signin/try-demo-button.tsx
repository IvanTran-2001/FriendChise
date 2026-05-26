"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

/**
 * Client component — must be a child of the demo <form> so useFormStatus
 * can detect when the server action is pending.
 */
export function TryDemoButton() {
  const { pending } = useFormStatus();

  return (
    <>
      {/* Full-page overlay while the demo org is being seeded */}
      {pending && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium text-foreground">
            Setting up your demo…
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            This only takes a few seconds
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Setting up…" : "Try Demo"}
      </button>
    </>
  );
}
