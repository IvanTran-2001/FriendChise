"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/dialogs/sheet";
import type { DocNavTreeNode } from "@/lib/docs";
import { DocSearchDialog } from "@/app/doc/_components/doc-search-dialog";
import { DocSidebarTree } from "@/app/doc/_components/doc-sidebar-tree";

type DocNavbarActionsProps = {
  navTree: DocNavTreeNode[];
};

export function DocNavbarActions({ navTree }: DocNavbarActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-full border border-border/70 bg-background/85 lg:hidden"
            aria-label="Open documentation navigation"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[85vw] max-w-xs overflow-y-auto p-4">
          <SheetHeader className="p-0">
            <SheetTitle>Documentation</SheetTitle>
          </SheetHeader>
          <DocSidebarTree tree={navTree} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <DocSearchDialog tree={navTree} />

      <Link
        href="/doc/getting-started"
        className="hidden rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground md:inline-block"
      >
        Getting Started
      </Link>
      <Link
        href="/doc/contributing"
        className="hidden rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground md:inline-block"
      >
        Contributing
      </Link>
      <Link
        href="/doc/contributing/support"
        className="hidden rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground lg:inline-block"
      >
        Support
      </Link>
    </div>
  );
}