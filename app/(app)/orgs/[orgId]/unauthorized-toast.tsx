"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Reads ?unauthorized=1 from the URL (placed there by requireOrgPermissionPage
 * and requireParentOrgOwnerPage on redirect) and fires a Sonner error toast,
 * then strips the param from history so a hard-refresh doesn't re-show it.
 */
export function UnauthorizedToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shownRef = useRef(false);

  useEffect(() => {
    if (searchParams.get("unauthorized") && !shownRef.current) {
      shownRef.current = true;
      toast.error("You don't have permission to access that page.");
      // Strip the param from the URL without adding to history
      const url = new URL(window.location.href);
      url.searchParams.delete("unauthorized");
      router.replace(url.pathname + url.search + url.hash);
    }
  }, [searchParams, router]);

  return null;
}
