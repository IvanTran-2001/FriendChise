import type { AnnouncementFeedItem } from "@/lib/services/announcements";
import {
  getUnseenAnnouncementCount,
  getPaginatedAnnouncementHistoryForUser,
} from "@/lib/services/announcements";
import {
  getUnseenInviteCount,
  getUnseenNotificationCount,
  getPaginatedInvitesForUser,
  getPaginatedNotificationsForUser,
  type InviteItem,
  type NotificationItem,
} from "@/lib/services/invites";

export type NotificationFeedItem =
  | {
      kind: "invite";
      id: string;
      createdAt: Date;
      invite: InviteItem;
    }
  | {
      kind: "notification";
      id: string;
      createdAt: Date;
      notification: NotificationItem;
    }
  | {
      kind: "announcement";
      id: string;
      createdAt: Date;
      announcement: AnnouncementFeedItem;
    };

export type NotificationFeedPage = {
  items: NotificationFeedItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

/**
 * Returns the total unseen count across invites, notifications, and announcements.
 */
export async function getNotificationUnseenCountForUser(
  userId: string,
): Promise<number> {
  const [inviteCount, notificationCount, announcementCount] = await Promise.all([
    getUnseenInviteCount(userId),
    getUnseenNotificationCount(userId),
    getUnseenAnnouncementCount(userId),
  ]);

  return inviteCount + notificationCount + announcementCount;
}

function buildFeedItems(
  invites: InviteItem[],
  notifications: NotificationItem[],
  announcements: AnnouncementFeedItem[],
): NotificationFeedItem[] {
  return [
    ...invites.map((invite) => ({
      kind: "invite" as const,
      id: `invite-${invite.id}`,
      createdAt: invite.createdAt,
      invite,
    })),
    ...notifications.map((notification) => ({
      kind: "notification" as const,
      id: `notification-${notification.id}`,
      createdAt: notification.createdAt,
      notification,
    })),
    ...announcements.map((announcement) => ({
      kind: "announcement" as const,
      id: `announcement-${announcement.id}`,
      createdAt: announcement.createdAt,
      announcement,
    })),
  ].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export async function getNotificationFeedForUser(
  userId: string,
  page: number,
  pageSize: number = 10,
  options: { view?: "all" | "unseen" } = {},
): Promise<NotificationFeedPage> {
  const { view = "all" } = options;
  const requestedPage = Math.max(1, Math.floor(page));
  const limit = requestedPage * pageSize;

  const [invitePage, notificationPage, announcementPage] =
    await Promise.all([
      getPaginatedInvitesForUser(userId, 1, limit, { view }),
      getPaginatedNotificationsForUser(userId, 1, limit, { view }),
      getPaginatedAnnouncementHistoryForUser(userId, 1, limit, { view }),
    ]);

  const invites = invitePage.items;
  const notifications = notificationPage.items;
  const announcements = announcementPage.items;
  const mergedFeed = buildFeedItems(invites, notifications, announcements);
  const totalCount = invitePage.total + notificationPage.total + announcementPage.totalCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    items: mergedFeed.slice(start, start + pageSize),
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
  };
}
