import { notFound } from "next/navigation";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { requireOrgOwnerPage } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
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
  // Announcements are owner-only because edits, deletes, and expiry changes
  // are exposed directly from the list UI.
  await requireOrgOwnerPage(orgId);

  const [org, announcements] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, ownerId: true, name: true },
    }),
    getAnnouncementsPage(orgId, { page, pageSize: PAGE_SIZE, order }),
  ]);

  if (!org) notFound();

  const canManage = true;

  return (
    <>
      <RegisterPageSidebarSubContent
        content={<AnnouncementSidebarContent orgId={orgId} order={order} canManage={canManage} />}
      />
      <AnnouncementClient
        orgId={orgId}
        orgName={org.name}
        announcements={announcements.announcements}
        order={order}
        canManage={canManage}
        page={announcements.page}
        totalPages={announcements.totalPages}
        totalCount={announcements.totalCount}
      />
    </>
  );
}