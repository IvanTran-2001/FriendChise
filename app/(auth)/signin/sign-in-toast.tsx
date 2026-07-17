"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Fires a Sonner toast when the sign-in page receives a `hint` query param
 * (e.g. account_required — set by the auth middleware when an unauthenticated
 * user tries to visit a protected page directly).
 * Rendered as a pure side-effect component; returns no markup.
 */
export function SignInToast({ hint }: { hint?: string }) {
  useEffect(() => {
    if (hint === "account_required") {
      toast.info("You need an account to access FriendChise.", {
        duration: 5000,
      });
    }
    if (hint === "demo_capacity") {
      toast.error("Demo is at capacity right now. Try again in a moment.", {
        duration: 6000,
      });
    }
    if (hint === "demo_high_load") {
      toast.error("Demo is under high load. Try again in about 10 minutes.", {
        duration: 6000,
      });
    }
    if (hint === "demo_unavailable") {
      toast.error("Demo is temporarily unavailable. Please try again shortly.", {
        duration: 6000,
      });
    }
  }, [hint]);

  return null;
}
