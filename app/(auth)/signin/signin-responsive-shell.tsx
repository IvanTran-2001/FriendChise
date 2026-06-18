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

  return isMobile ? mobile : desktop;
}
