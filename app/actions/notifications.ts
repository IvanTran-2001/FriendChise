"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
  markAnnouncementSeen,
} from "@/lib/services/announcements";
import {
  markNotificationsSeen,
} from "@/lib/services/invites";
import { prisma } from "@/lib/platform/prisma";

export async function markNotificationSeenAction(
  notificationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  const updated = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId: session.user.id,
      seenAt: null,
    },
    data: { seenAt: new Date() },
  });

  if (updated.count === 0) {
    return { ok: true };
  }

  revalidatePath("/");
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAnnouncementSeenAction(
  announcementId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  await markAnnouncementSeen(session.user.id, announcementId);
  revalidatePath("/");
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsSeenAction(): Promise<{
  ok: true;
} | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  await markNotificationsSeen(session.user.id);
  revalidatePath("/");
  revalidatePath("/notifications");
  return { ok: true };
}