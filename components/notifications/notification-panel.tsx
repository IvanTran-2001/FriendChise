"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { markInvitesSeenAction } from "@/app/actions/invites";
import { NotificationList } from "./notification-list";
import type { InviteItem, NotificationItem } from "@/lib/services/invites";

export function NotificationPanel({
  invites,
  unseenCount,
  notifications,
}: {
  invites: InviteItem[];
  unseenCount: number;
  notifications: NotificationItem[];
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleOpen(next: boolean) {
    setOpen(next);
    if (next && unseenCount > 0) {
      await markInvitesSeenAction();
      router.refresh();
    }
  }

  function handleAction() {
    setOpen(false);
    router.refresh();
  }

  const BellButton = (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Notifications"
      className="relative h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
    >
      <Bell className="h-4 w-4" />
      {unseenCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center px-0.5 leading-none font-medium">
          {unseenCount > 99 ? "99+" : unseenCount}
        </span>
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpen}>
        <SheetTrigger asChild>{BellButton}</SheetTrigger>
        <SheetContent
          side="bottom"
          className="data-[side=bottom]:h-[calc(100dvh-4rem)] p-0 flex flex-col rounded-t-2xl"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          {/* Drag handle */}
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mt-3 mb-0 shrink-0" />
          <NotificationList
            invites={invites}
            notifications={notifications}
            onAction={handleAction}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>{BellButton}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-95 h-120 p-0 flex flex-col overflow-hidden shadow-xl"
      >
        <NotificationList
          invites={invites}
          notifications={notifications}
          onAction={handleAction}
        />
      </PopoverContent>
    </Popover>
  );
}
