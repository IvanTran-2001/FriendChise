"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function ItemListSidebarContent({ orgId }: { orgId: string }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Title row */}
      <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          Item List
        </span>
      </div>

      {/* Back */}
      <Link
        href={`/orgs/${orgId}/tools`}
        className="flex items-center gap-2 h-12 px-4 text-sm border-b border-border text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors shrink-0"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
    </div>
  );
}
