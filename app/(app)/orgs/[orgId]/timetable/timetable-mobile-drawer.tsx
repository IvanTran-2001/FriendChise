"use client";

/**
 * TimetableMobileDrawer — trigger button + bottom Sheet for mobile.
 *
 * The trigger button (a filter icon) is only visible on small screens (`md:hidden`).
 * On desktop the same content is shown in the page sidebar slot via
 * `RegisterPageSidebar`.
 */
import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";

interface TimetableMobileDrawerProps {
  children: ReactNode;
}

export function TimetableMobileDrawer({ children }: TimetableMobileDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trigger — visible on mobile only */}
      <Button
        variant="outline"
        size="sm"
        className="md:hidden shrink-0 gap-1.5"
        onClick={() => setOpen(true)}
        aria-label="Open filters and actions"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto p-0">
          {children}
        </SheetContent>
      </Sheet>
    </>
  );
}
