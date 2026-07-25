"use client";

import { SidebarNavItem, type SidebarNavItemProps } from "./sidebar-nav-item";

type PageSidebarNavItemProps = Omit<SidebarNavItemProps, "variant">;

/**
 * Convenience wrapper for page-level sidebars so menu tabs all use the same
 * shared page variant without repeating `variant="page"` at every call site.
 */
export function PageSidebarNavItem(props: PageSidebarNavItemProps) {
  return <SidebarNavItem {...props} variant="page" />;
}