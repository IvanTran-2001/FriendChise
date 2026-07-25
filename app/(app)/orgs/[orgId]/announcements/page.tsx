import { notFound } from "next/navigation";
import { RegisterPageSidebarSubContent } from "@/components/layout/contexts/page-sidebar-context";
import { requireUserPage } from "@/lib/authz";
import { prisma } from "@/lib/platform/prisma";
import { getAnnouncementsPage } from "@/lib/services/announcements";
import { AnnouncementSidebarContent, type AnnouncementOrder } from "./_components/announcement-sidebar-content";
import { AnnouncementClient } from "./_components/announcement-client";

const PAGE_SIZE = 10;

export default async function AnnouncementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ order?: string | string[]; page?: string | string[] }>;
}) {
  const { orgId } = await params;
  const rawSearchParams = await searchParams;
  const rawOrder = Array.isArray(rawSearchParams.order)
    ? rawSearchParams.order[0]
    : rawSearchParams.order;
  const rawPage = Array.isArray(rawSearchParams.page)
    ? rawSearchParams.page[0]
    : rawSearchParams.page;
  const order: AnnouncementOrder = rawOrder === "oldest" ? "oldest" : "newest";
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, ownerId: true, name: true },
  });

  if (!org) notFound();

  // Any signed-in user can read the feed; only the org owner gets edit controls.
  const { userId } = await requireUserPage();

  const announcements = await getAnnouncementsPage(orgId, {
    page,
    pageSize: PAGE_SIZE,
    order,
  });

  // The owner check only drives the UI affordances, not page access.
  const canManage = org.ownerId === userId;
  const feedKey = [
    order,
    announcements.page,
    announcements.announcements.map((announcement) => announcement.id).join("."),
  ].join("|");

  return (
    <>
      <RegisterPageSidebarSubContent
        content={<AnnouncementSidebarContent orgId={orgId} order={order} canManage={canManage} />}
      />
      <AnnouncementClient
        key={feedKey}
        orgId={orgId}
        orgName={org.name}
        announcements={announcements.announcements}
        order={order}
        canManage={canManage}
        page={announcements.page}
        totalPages={announcements.totalPages}
      />
    </>
  );
}