import { headers } from "next/headers";
import { requireUserPage } from "@/lib/authz";
import type { NotificationFeedItem } from "@/lib/services/notification-feed";
import { NotificationClient } from "./notification-client";

export const metadata = {
  title: "Notifications | FriendChise",
};

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function NotificationsPage({ searchParams }: PageProps) {
  await requireUserPage();

  const resolvedParams = await searchParams;
  const pageStr = resolvedParams.page;
  const viewParam = resolvedParams.view;
  const page = typeof pageStr === "string" ? parseInt(pageStr, 10) : 1;
  const validPage = isNaN(page) || page < 1 ? 1 : page;
  const view = viewParam === "unseen" ? "unseen" : "all";
  const limit = 10;

  const headerList = await headers();
  const origin = `${headerList.get("x-forwarded-proto") ?? "http"}://${headerList.get("host")}`;
  const response = await fetch(`${origin}/api/mobile/me/notifications?page=${validPage}&pageSize=${limit}&view=${view}`, {
    headers: {
      cookie: headerList.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load notifications.");
  }

  const feedPage = (await response.json()) as {
    items: NotificationFeedItem[];
    unseenCount: number;
    page: number;
    totalPages: number;
  };

  return (
    <NotificationClient
      items={feedPage.items}
      unseenItemCount={feedPage.unseenCount}
      view={view}
      page={feedPage.page}
      totalPages={feedPage.totalPages}
    />
  );
}
