"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MoreHorizontal,
  Megaphone,
  CalendarClock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { AnnouncementScope } from "@prisma/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  totalCount,
}: {
  orgId: string;
  orgName: string;
  announcements: AnnouncementItem[];
  order: AnnouncementOrder;
  canManage: boolean;
  page: number;
  totalPages: number;
  totalCount: number;
}) {
  const previousHref = buildListHref(orgId, order, Math.max(1, page - 1));
  const nextHref = buildListHref(orgId, order, Math.min(totalPages, page + 1));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm">
        <div className="absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-4 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary shadow-sm backdrop-blur">
              <Megaphone className="h-3.5 w-3.5" />
              Announcements
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
              {orgName} announcements
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {canManage
                ? "A running feed of org updates. Owners can edit, extend expiry, or remove announcements directly from each post."
                : "A running feed of org updates. Open a post to read the full announcement."}
            </p>
          </div>
          <div className="grid min-w-52 grid-cols-2 gap-3 sm:grid-cols-3 lg:w-auto">
            <div className="rounded-2xl border border-border/70 bg-background/85 px-3 py-2.5 shadow-sm backdrop-blur">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Posts
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{totalCount}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/85 px-3 py-2.5 shadow-sm backdrop-blur">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Page
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {page}/{totalPages}
              </p>
            </div>
            <div className="col-span-2 rounded-2xl border border-border/70 bg-background/85 px-3 py-2.5 shadow-sm backdrop-blur sm:col-span-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Visible now
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{announcements.length}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Latest feed
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {canManage
                ? "Newest posts first. Owners can edit from each card or use the sidebar to change order."
                : "Newest posts first. Use the sidebar to change order."}
            </p>
          </div>
        </div>

        <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
            <CardTitle>Posts</CardTitle>
            <CardDescription>
              Showing {announcements.length} of {totalCount}.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <CalendarClock className="h-10 w-10 text-muted-foreground/30" />
                <p className="mt-3 text-sm font-medium">No announcements yet</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Post the first update to show everyone where the org is headed this week.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 px-4 pb-4 sm:px-6 sm:pb-6">
                {announcements.map((announcement) => (
                  <AnnouncementCard
                    key={announcement.id}
                    orgId={orgId}
                    canManage={canManage}
                    announcement={announcement}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={previousHref}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  page === 1 && "pointer-events-none opacity-50",
                )}
                aria-disabled={page === 1}
                tabIndex={page === 1 ? -1 : 0}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Link>
              <Link
                href={nextHref}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  page === totalPages && "pointer-events-none opacity-50",
                )}
                aria-disabled={page === totalPages}
                tabIndex={page === totalPages ? -1 : 0}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function buildListHref(orgId: string, order: AnnouncementOrder, page: number) {
  const params = new URLSearchParams();
  if (order === "oldest") params.set("order", order);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/orgs/${orgId}/announcements?${query}` : `/orgs/${orgId}/announcements`;
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
            <button
              type="button"
              onClick={openEditPanel}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {formatDateTime(announcement.createdAt)}
                </div>
                <h2 className="text-lg font-semibold tracking-tight sm:text-[1.35rem]">
                  {announcement.title}
                </h2>
                <p className="max-w-none whitespace-pre-wrap text-sm leading-7 text-muted-foreground line-clamp-6">
                  {announcement.description}
                </p>
                <div className="flex items-center justify-end gap-1.5 text-xs font-medium text-primary">
                  Edit announcement
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </button>

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
          <AlertDialogCancel disabled={false}>Cancel</AlertDialogCancel>
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