"use client";

import { useParams, usePathname } from "next/navigation";
import { LayoutList, Package } from "lucide-react";
import { usePageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { PageSidebarNavItem } from "@/components/layout/page-sidebar-nav-item";

const tabs = [
  {
    label: "Items",
    icon: Package,
    href: (orgId: string) => `/orgs/${orgId}/tools/item-list`,
    exact: true,
  },
  {
    label: "Set",
    icon: LayoutList,
    href: (orgId: string) => `/orgs/${orgId}/tools/item-list/lists`,
    exact: true,
  },
];

export function ItemListSidebarShell() {
  const { orgId } = useParams<{ orgId: string }>();
  const pathname = usePathname();
  const subContent = usePageSidebarSubContent();

  return (
    <aside className="flex flex-col flex-1 overflow-y-auto">
      {/* Keep the top navigation on the shared page-sidebar item so tab styling stays consistent. */}
      <nav className="shrink-0">
        {tabs.map(({ label, icon: Icon, href, exact }) => {
          const url = href(orgId);
          const isActive = exact ? pathname === url : pathname.startsWith(url);
          return <PageSidebarNavItem key={label} title={label} icon={Icon} url={url} isActive={isActive} />;
        })}
      </nav>

      {/* Page-specific sub-content lives below the shared tab row. */}
      {subContent}
    </aside>
  );
}
