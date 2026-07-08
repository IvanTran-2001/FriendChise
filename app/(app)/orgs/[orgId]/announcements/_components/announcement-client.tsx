"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MoreHorizontal,
  Megaphone,
  CalendarClock,
  ArrowRight,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { AnnouncementScope } from "@prisma/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { AddAnnouncementPanel } from "./add-announcement-panel";
import {
  deleteAnnouncementAction,
  extendAnnouncementExpiryAction,
} from "@/app/actions/announcements";
import type { AnnouncementOrder } from "./announcement-sidebar-content";

type AnnouncementItem = {
  id: string;
  orgId: string;
  title: string;
  description: string;
  scope: AnnouncementScope;
  expiresAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function formatDateTime(date: Date | string) {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function scopeLabel(scope: AnnouncementScope) {
  return scope === AnnouncementScope.GLOBAL ? "Shared" : "Org only";
}

function scopeStyle(scope: AnnouncementScope) {
  return scope === AnnouncementScope.GLOBAL
    ? "bg-primary/10 text-primary"
    : "bg-muted text-muted-foreground";
}

export function AnnouncementClient({
  orgId,
  orgName,
  announcements,
  order,
  canManage,
  page,
  totalPages,
}: {
  orgId: string;
  orgName: string;
  announcements: AnnouncementItem[];
  order: AnnouncementOrder;
  canManage: boolean;
  page: number;
  totalPages: number;
}) {
  const [items, setItems] = useState<AnnouncementItem[]>(announcements);
  const [currentPage, setCurrentPage] = useState(page);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(page < totalPages);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestSeqRef = useRef(0);

  const mergeUniqueAnnouncements = useCallback((current: AnnouncementItem[], incoming: AnnouncementItem[]) => {
    const byId = new Map<string, AnnouncementItem>();
    for (const item of current) byId.set(item.id, item);
    for (const item of incoming) byId.set(item.id, item);
    return Array.from(byId.values());
  }, []);

  const loadPage = useCallback(
    async ({ nextPage, replace, signal, requestSeq }: { nextPage: number; replace: boolean; signal: AbortSignal; requestSeq: number; }) => {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", "10");
      if (order === "oldest") params.set("order", order);

      const response = await fetch(`/api/orgs/${orgId}/announcements?${params.toString()}`, { signal });
      if (!response.ok) throw new Error("Failed to load announcements.");

      const data = (await response.json()) as {
        announcements: AnnouncementItem[];
        page: number;
        totalPages: number;
      };

      if (requestSeqRef.current !== requestSeq) return;

      setItems((current) => (replace ? mergeUniqueAnnouncements([], data.announcements) : mergeUniqueAnnouncements(current, data.announcements)));
      setCurrentPage(data.page);
      setHasMore(data.page < data.totalPages);
    },
    [mergeUniqueAnnouncements, order, orgId],
  );

  useEffect(() => {
    if (isLoadingMore || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (isLoadingMore || !hasMore) return;

        const nextPage = currentPage + 1;
        const requestSeq = requestSeqRef.current;
        const controller = new AbortController();
        setIsLoadingMore(true);

        const cleanup = () => controller.abort();

        void loadPage({ nextPage, replace: false, signal: controller.signal, requestSeq })
          .catch(() => {
            // Retry on next intersection.
          })
          .finally(() => {
            if (requestSeqRef.current === requestSeq) setIsLoadingMore(false);
          });
        return cleanup;
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [currentPage, hasMore, isLoadingMore, loadPage]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          <Megaphone className="h-3.5 w-3.5" />
          Announcements
        </div>
        <div className="mt-2 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {orgName}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Updates, notices, and changes that matter.
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
            <CardTitle>Updates</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <CalendarClock className="h-10 w-10 text-muted-foreground/30" />
                <p className="mt-3 text-sm font-medium">Nothing to show yet</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Check back later for updates.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 px-4 pb-4 sm:px-6 sm:pb-6">
                {items.map((announcement) => (
                  <AnnouncementCard
                    key={announcement.id}
                    orgId={orgId}
                    canManage={canManage}
                    announcement={announcement}
                  />
                ))}
                {hasMore && (
                  <div
                    ref={sentinelRef}
                    className="flex items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground"
                  >
                    {isLoadingMore ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading more…
                      </span>
                    ) : (
                      <span>Scroll for more updates</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AnnouncementCard({
  orgId,
  canManage,
  announcement,
}: {
  orgId: string;
  canManage: boolean;
  announcement: AnnouncementItem;
}) {
  const router = useRouter();
  const { open, close } = useActionSidebar();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [, startTransition] = useTransition();
  const panelKeyRef = useRef(0);
  const detailHref = `/orgs/${orgId}/announcements/${announcement.id}`;

  function openEditPanel() {
    const key = ++panelKeyRef.current;
    open(
      "Edit Announcement",
      <AddAnnouncementPanel
        key={key}
        orgId={orgId}
        mode="edit"
        announcement={announcement}
      />,
    );
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAnnouncementAction(orgId, announcement.id);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to delete announcement.");
        return;
      }
      setConfirmOpen(false);
      toast.success("Announcement deleted.");
      router.refresh();
      close();
    });
  }

  function handleExtendExpiry() {
    startTransition(async () => {
      const result = await extendAnnouncementExpiryAction(orgId, announcement.id);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to extend expiry.");
        return;
      }
      toast.success("Expiry extended by one day.");
      router.refresh();
      close();
    });
  }

  return (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      {canManage ? (
        <div className="group rounded-[1.5rem] border border-border/70 bg-background p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md sm:p-5">
          <div className="flex items-start gap-3">
            <Link href={detailHref} className="min-w-0 flex-1 text-left">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {formatDateTime(announcement.createdAt)}
                </div>
                <h2 className="text-lg font-semibold tracking-tight sm:text-[1.2rem]">
                  {announcement.title}
                </h2>
                <p className="max-w-none whitespace-pre-wrap text-sm leading-7 text-muted-foreground line-clamp-6">
                  {announcement.description}
                </p>
                <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  Open post
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>

            <div className="flex shrink-0 items-start gap-2">
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${scopeStyle(announcement.scope)}`}
              >
                {scopeLabel(announcement.scope)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Announcement actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openEditPanel(); }}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleExtendExpiry(); }}>
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Extend expiry
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setConfirmOpen(true);
                    }}
                    variant="destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      ) : (
        <Link
          href={detailHref}
          className="group block rounded-[1.5rem] border border-border/70 bg-background p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md sm:p-5"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {formatDateTime(announcement.createdAt)}
                </div>
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                  {announcement.title}
                </h2>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${scopeStyle(announcement.scope)}`}
              >
                {scopeLabel(announcement.scope)}
              </span>
            </div>
            <p className="max-w-none whitespace-pre-wrap text-sm leading-7 text-muted-foreground line-clamp-6">
              {announcement.description}
            </p>
            <div className="flex items-center justify-end gap-1.5 text-xs font-medium text-primary">
              Open post
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </Link>
      )}

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete announcement &quot;{announcement.title}&quot;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the announcement from the org. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}