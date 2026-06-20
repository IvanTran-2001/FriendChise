"use client";

import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export function SignInResponsiveShell({
  mobile,
  desktop,
}: {
  mobile: ReactNode;
  desktop: ReactNode;
}) {
  const isMobile = useIsMobile();

  if (isMobile === undefined) {
    return null;
  }

  return isMobile ? mobile : desktop;
}
