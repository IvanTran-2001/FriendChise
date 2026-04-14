"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export function OrgNotFoundToast() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("orgNotFound")) {
      toast.error(
        "That organization wasn't found. It may have been deleted or you may no longer have access.",
      );
      router.replace("/");
    }
  }, [searchParams, router]);

  return null;
}
