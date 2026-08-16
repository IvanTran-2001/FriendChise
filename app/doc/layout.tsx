import type { ReactNode } from "react";
import { DocNavbar } from "@/app/doc/_components/doc-navbar";
import { DocSidebarScrollFrame } from "@/app/doc/_components/doc-sidebar-scroll-frame";
import { DocSidebarTree } from "@/app/doc/_components/doc-sidebar-tree";
import { getDocNavTree } from "@/lib/docs";

export default async function DocLayout({
  children,
}: {
  children: ReactNode;
}) {
  const navTree = await getDocNavTree();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <DocNavbar navTree={navTree} />
      <main className="mx-auto flex w-full max-w-330 flex-1 min-h-0 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid min-h-0 flex-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_220px]">
          {/* Persistent across /doc/* navigations so the sidebar keeps its scroll position and expanded folders. */}
          <aside className="hidden min-h-0 min-w-0 lg:block">
            <DocSidebarScrollFrame>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Documentation
              </p>
              <DocSidebarTree tree={navTree} />
            </DocSidebarScrollFrame>
          </aside>

          {children}
        </div>
      </main>
    </div>
  );
}
