"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";

/**
 * Shared submit button for demo-provisioning forms.
 *
 * Must live inside the parent <form action={...}> so useFormStatus can read
 * the pending state for the current submission.
 */
export function DemoSubmitButton({
  children,
  loadingLabel = "Setting up your demo…",
  size = "default",
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  loadingLabel?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <>
      {pending && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {loadingLabel}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            This only takes a few seconds
          </p>
        </div>
      )}

      <Button
        type="submit"
        size={size}
        variant={variant}
        disabled={pending}
        aria-busy={pending}
        className={cn("gap-2", className)}
      >
        {pending && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
        {pending ? "Setting up…" : children}
      </Button>
    </>
  );
}