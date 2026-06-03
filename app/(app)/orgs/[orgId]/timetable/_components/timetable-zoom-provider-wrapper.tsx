"use client";

import type { ReactNode } from "react";
import { TimetableZoomProvider } from "../_shared/timetable-zoom-context";

export function TimetableZoomProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  return <TimetableZoomProvider>{children}</TimetableZoomProvider>;
}
