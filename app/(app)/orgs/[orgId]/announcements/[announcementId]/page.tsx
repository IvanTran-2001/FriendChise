import Link from "next/link";
import { notFound } from "next/navigation";
import { AnnouncementScope } from "@prisma/client";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { requireOrgMemberPage } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getAnnouncementById } from "@/lib/services/announcements";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnnouncementSidebarContent, type AnnouncementOrder } from "../_components/announcement-sidebar-content";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function scopeLabel(scope: AnnouncementScope) {
  return scope === AnnouncementScope.GLOBAL ? "Shared" : "Org only";
}

function scopeStyle(scope: AnnouncementScope) {
  return scope === AnnouncementScope.GLOBAL
    ? "bg-primary/10 text-primary"
    : "bg-muted text-muted-foreground";
}

export default async function AnnouncementPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; announcementId: string }>;
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const { orgId, announcementId } = await params;
  const rawSearchParams = await searchParams;
  const rawOrder = Array.isArray(rawSearchParams.order)
    ? rawSearchParams.order[0]
    : rawSearchParams.order;
  const order: AnnouncementOrder = rawOrder === "oldest" ? "oldest" : "newest";
  const { userId } = await requireOrgMemberPage(orgId);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerId: true },
  });

  const announcement = await getAnnouncementById(orgId, announcementId);
  if (!announcement) notFound();

  const canManage = org?.ownerId === userId;

  return (
    <>
      <RegisterPageSidebarSubContent
        content={
          <AnnouncementSidebarContent orgId={orgId} order={order} canManage={canManage} />
        }
      />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 px-1">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/orgs/${orgId}/announcements${order === "oldest" ? "?order=oldest" : ""}`}>
              Back to announcements
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            Posted {formatDateTime(announcement.createdAt)}
          </span>
        </div>

        <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
          <div className="h-1.5 bg-linear-to-r from-primary/70 via-primary/35 to-transparent" />
          <CardHeader className="space-y-4 border-b border-border/60 bg-muted/15 p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${scopeStyle(announcement.scope)}`}
              >
                {scopeLabel(announcement.scope)}
              </span>
              {announcement.expiresAt && (
                <span className="text-xs text-muted-foreground">
                  Expires {formatDateTime(announcement.expiresAt)}
                </span>
              )}
            </div>
            <div className="max-w-3xl space-y-3">
              <CardTitle className="text-3xl leading-tight tracking-tight sm:text-5xl">
                {announcement.title}
              </CardTitle>
              <CardDescription className="text-sm leading-6 sm:text-base">
                Announcement details for this org.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-7">
            <div className="rounded-3xl border border-border bg-background p-5 shadow-sm sm:p-6">
              <p className="whitespace-pre-wrap text-sm leading-8 text-foreground sm:text-base">
                {announcement.description}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}