"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, History } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
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
  SheetFooter,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/dialogs/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationList } from "./notification-list";
import type { NotificationFeedItem } from "@/lib/services/notification-feed";

export function NotificationPanel({
  items,
  unseenItems,
  unseenCount,
}: {
  items: NotificationFeedItem[];
  unseenItems: NotificationFeedItem[];
  unseenCount: number;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleOpen(next: boolean) {
    setOpen(next);
  }

  function handleAction() {
    setOpen(false);
    router.refresh();
  }

  function handleSeen() {
    router.refresh();
  }

  const notificationListProps: ComponentProps<typeof NotificationList> = {
    allItems: items,
    unseenItems,
    unseenCount,
    onAction: handleAction,
    onSeen: handleSeen,
  };

  const BellButton = (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Notifications"
      className="relative h-9 w-9 rounded-full border border-border/70 bg-background/85 text-muted-foreground shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-background hover:text-foreground hover:shadow-md"
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
        <SheetContent side="bottom" className="p-0 flex flex-col rounded-t-2xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          {/* Drag handle */}
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mt-3 mb-0 shrink-0" />
          <div className="flex-1 min-h-0 overflow-hidden">
            <NotificationList {...notificationListProps} />
          </div>

          <SheetFooter className="p-0">
            <div className="w-full shrink-0 border-t px-4 py-2.5 bg-background">
              <Link
                href="/notifications"
                onClick={handleAction}
                className="flex w-full items-center justify-center gap-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <History className="size-3" />
                View all history
              </Link>
            </div>
          </SheetFooter>
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
        <div className="flex-1 min-h-0 overflow-hidden">
          <NotificationList {...notificationListProps} />
        </div>
        
        <div className="shrink-0 border-t px-4 py-2.5 bg-background">
          <Link
            href="/notifications"
            onClick={handleAction}
            className="flex w-full items-center justify-center gap-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <History className="size-3" />
            View all history
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
