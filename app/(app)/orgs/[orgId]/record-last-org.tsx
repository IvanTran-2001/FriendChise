"use client";

import { useEffect } from "react";

export function RecordLastOrg({ orgId }: { orgId: string }) {
  useEffect(() => {
    try {
      localStorage.setItem("lastOrgId", orgId);
    } catch {
      // localStorage unavailable (private mode, etc.)
    }
  }, [orgId]);

  return null;
}
