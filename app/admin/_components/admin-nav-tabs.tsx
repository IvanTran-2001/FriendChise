"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ImageIcon, MessageSquareMore, LayoutDashboard } from "lucide-react";

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/admin/feedback",
    label: "Feedback",
    icon: MessageSquareMore,
  },
  {
    href: "/admin/photos",
    label: "Photos",
    icon: ImageIcon,
  },
] as const;

export function AdminNavTabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-2">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact?
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Button
            key={item.href}
            variant={isActive ? "default" : "outline"}
            asChild
            className={cn(
              "justify-start gap-2.5 rounded-xl",
              isActive && "shadow-sm",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Link href={item.href}>
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}