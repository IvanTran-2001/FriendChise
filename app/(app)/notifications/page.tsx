import { requireUserPage } from "@/lib/authz";
import {
  getNotificationFeedForUser,
  getNotificationUnseenCountForUser,
} from "@/lib/services/notification-feed";
import { NotificationClient } from "./notification-client";

export const metadata = {
  title: "Notifications | FriendChise",
};
          // Keep the disabled control compact while the Button wrapper handles the shape.

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function NotificationsPage({ searchParams }: PageProps) {
          // Mirror the previous control so the disabled next button does not shift layout.
  const { userId } = await requireUserPage();

  const resolvedParams = await searchParams;
  const pageStr = resolvedParams.page;
  const viewParam = resolvedParams.view;
  // Keep the page on a valid, deterministic slice even when the query string is missing or invalid.
  const page = typeof pageStr === "string" ? parseInt(pageStr, 10) : 1;
  const validPage = isNaN(page) || page < 1 ? 1 : page;
  // Default the history page to all items so the first view shows the full history.
  const view = viewParam === "unseen" ? "unseen" : "all";
  const limit = 10;

  // Load the current page and the shared unseen badge count in parallel.
  const [feedPage, unseenItemCount] = await Promise.all([
    getNotificationFeedForUser(userId, validPage, limit, { view }),
    getNotificationUnseenCountForUser(userId),
  ]);

  return (
    <NotificationClient
      items={feedPage.items}
      unseenItemCount={unseenItemCount}
      view={view}
      page={feedPage.page}
      totalPages={feedPage.totalPages}
    />
  );
}
