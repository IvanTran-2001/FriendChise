"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageSidebarSubContent } from "@/components/layout/page-sidebar-context";

export function MembersSidebarShell() {
  const { orgId } = useParams<{ orgId: string }>();
  const pathname = usePathname();
  const subContent = usePageSidebarSubContent();

  const membershipsHref = `/orgs/${orgId}/memberships`;

  return (
    <aside className="flex flex-col flex-1 overflow-y-auto">
      {/* Panel title */}
      <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          Members
        </span>
      </div>

      {/* Nav tab */}
      <nav className="shrink-0 border-b border-border">
        <Link
          href={membershipsHref}
          className={cn(
            "relative flex items-center gap-2.5 h-12 px-4 text-sm transition-colors",
            pathname === membershipsHref
              ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium before:absolute before:top-2 before:left-2 before:w-2.5 before:h-2.5 before:border-t-2 before:border-l-2 before:border-primary after:absolute after:bottom-2 after:right-2 after:w-2.5 after:h-2.5 after:border-b-2 after:border-r-2 after:border-primary"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
          aria-current={pathname === membershipsHref ? "page" : undefined}
        >
          <Users className="h-5 w-5 shrink-0" />
          <span className="truncate">List</span>
        </Link>
      </nav>

      {/* Page-specific sub-content (filters, actions, etc.) */}
      {subContent}
    </aside>
  );
}
