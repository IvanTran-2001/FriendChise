"use client";

/**
 * Menu lists page client.
 * Owns the menu collection search, pagination, and the card actions that open
 * the create/edit sidebars.
 */

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Menu as MenuIcon,
  Plus,
  Search,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
import { RegisterPageSidebarSubContent } from "@/components/layout/contexts/page-sidebar-context";
import { RegisterPageToolbar } from "@/components/layout/contexts/toolbar-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { duplicateMenuAction, deleteMenuAction } from "@/app/actions/tools";
import { MenuSidebarContent } from "./menu-sidebar-content";
import { CreateMenuPanel } from "./create-menu-panel";
import { EditMenuPanel } from "../_components/edit-menu-panel";
import { MenuCardActions, type MenuCardMenu } from "./menu-card-actions";

type MenuSummary = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: Date;
  _count: { tabs: number; items: number };
};

interface MenuListsPageClientProps {
  orgId: string;
  menus: MenuSummary[];
  canManage: boolean;
  page: number;
  totalPages: number;
  totalCount: number;
  search: string;
}

function sortMenus(a: MenuSummary, b: MenuSummary) {
  return a.name.localeCompare(b.name);
}

function formatUpdatedAt(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function MenuListsPageClient({
  orgId,
  menus: initialMenus,
  canManage,
  page,
  totalPages,
  totalCount,
  search: initialSearch,
}: MenuListsPageClientProps) {
  const { open, close } = useActionSidebar();
  const router = useRouter();
  const searchParams = useSearchParams();
  const keyRef = useRef(0);
  const [menus, setMenus] = useState<MenuSummary[]>(initialMenus);
  const [search, setSearch] = useState(initialSearch);
  const [pendingMenuId, setPendingMenuId] = useState<string | null>(null);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setMenus(initialMenus);
  }, [initialMenus]);

  function buildHref(nextPage: number, nextSearch: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");

    if (nextSearch.trim()) params.set("q", nextSearch.trim());
    else params.delete("q");

    const query = params.toString();
    return query ? `/orgs/${orgId}/tools/menu?${query}` : `/orgs/${orgId}/tools/menu`;
  }

  function handleOpenMenu(menuId: string) {
    router.push(`/orgs/${orgId}/tools/menu/${menuId}`);
  }

  function handleCreateMenu() {
    const key = ++keyRef.current;
    open(
      "New Menu",
      <CreateMenuPanel
        key={key}
        orgId={orgId}
        onCreated={(menu) => {
          setMenus((prev) => [...prev, menu].sort(sortMenus));
          close();
          router.refresh();
        }}
        onClose={close}
      />,
    );
  }

  function handleEditMenu(menu: MenuCardMenu) {
    const key = ++keyRef.current;
    open(
      "Edit Menu",
      <EditMenuPanel
        key={key}
        orgId={orgId}
        menu={menu}
        onClose={close}
      />,
    );
  }

  async function handleDuplicate(menuId: string) {
    setPendingMenuId(menuId);
    try {
      const result = await duplicateMenuAction(orgId, menuId);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to duplicate menu.");
        return;
      }
      setMenus((prev) => [...prev, result.menu].sort(sortMenus));
      toast.success(`"${result.menu.name}" created.`);
      router.refresh();
    } finally {
      setPendingMenuId((current) => (current === menuId ? null : current));
    }
  }

  async function handleDelete(menuId: string) {
    setPendingMenuId(menuId);
    try {
      const result = await deleteMenuAction(orgId, menuId);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to delete menu.");
        return;
      }
      setMenus((prev) => prev.filter((menu) => menu.id !== menuId));
      toast.success("Menu deleted.");
      router.refresh();
    } finally {
      setPendingMenuId((current) => (current === menuId ? null : current));
    }
  }

  function handleSearchChange(nextSearch: string) {
    setSearch(nextSearch);
    router.replace(buildHref(1, nextSearch), { scroll: false });
  }

  const hasSearch = search.trim().length > 0;

  return (
    <>
      <RegisterPageSidebarSubContent
        content={
          <MenuSidebarContent
            orgId={orgId}
            canManage={canManage}
            onCreateMenu={handleCreateMenu}
          />
        }
      />

      <RegisterPageToolbar>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            aria-label="Search menus"
            placeholder="Search menus…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 h-7"
          />
        </div>
      </RegisterPageToolbar>

      <div className="flex flex-col gap-6 py-5">
        {menus.length === 0 ? (
          <div className="flex items-center justify-center rounded-2xl border border-dashed py-24">
            <div className="flex flex-col items-center gap-3 text-center">
              <MenuIcon className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-2xl font-semibold">
                {hasSearch ? `No menus match "${search}"` : "No menus yet"}
              </p>
              {!hasSearch && canManage && (
                <Button onClick={handleCreateMenu} className="mt-1">
                  <Plus className="h-4 w-4" />
                  New Menu
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {menus.map((menu) => (
              <div
                key={menu.id}
                role="link"
                tabIndex={0}
                onClick={() => handleOpenMenu(menu.id)}
                onKeyDown={(event) => {
                  if (
                    (event.key === "Enter" || event.key === " ") &&
                    event.target === event.currentTarget
                  ) {
                    event.preventDefault();
                    handleOpenMenu(menu.id);
                  }
                }}
                className="group relative cursor-pointer rounded-3xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="relative z-10 flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/15 dark:text-rose-300">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{menu.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {menu.description || "Menu description not set."}
                      </p>
                    </div>
                  </div>

                  {canManage && (
                    <div className="relative z-10">
                      <MenuCardActions
                        menu={menu}
                        menuId={menu.id}
                        disabled={pendingMenuId === menu.id}
                        onEdit={handleEditMenu}
                        onDuplicate={handleDuplicate}
                        onDelete={handleDelete}
                      />
                    </div>
                  )}
                </div>

                <div className="relative z-10 mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
                    {menu._count.tabs} tab{menu._count.tabs === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
                    {menu._count.items} item{menu._count.items === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
                    Updated {formatUpdatedAt(menu.updatedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {totalCount} menu{totalCount === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page <= 1}
                asChild={page > 1}
              >
                {page > 1 ? (
                  <a href={buildHref(page - 1, search)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page >= totalPages}
                asChild={page < totalPages}
              >
                {page < totalPages ? (
                  <a href={buildHref(page + 1, search)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
