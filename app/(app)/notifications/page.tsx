import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPaginatedNotificationsForUser } from "@/lib/services/invites";
import { NotificationCard } from "@/components/notifications/notification-card";
import { History, Bell, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Notifications | FriendChise",
};

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function NotificationsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const resolvedParams = await searchParams;
  const pageStr = resolvedParams.page;
  const page = typeof pageStr === "string" ? parseInt(pageStr, 10) : 1;
  const validPage = isNaN(page) || page < 1 ? 1 : page;
  const limit = 10;

  const { items, totalPages } = await getPaginatedNotificationsForUser(
    session.user.id,
    validPage,
    limit
  );

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div className="flex items-center gap-3 px-1">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Notification History</h1>
          <p className="text-sm text-muted-foreground">
            Browse your past notifications
          </p>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Bell className="size-10 opacity-20" />
            <p className="text-sm font-medium">No notifications found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {items.map((notif) => (
              <NotificationCard key={notif.id} notification={notif} />
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <Button
            variant="outline"
            size="sm"
            disabled={validPage <= 1}
            asChild={validPage > 1}
          >
            {validPage > 1 ? (
              <Link href={`/notifications?page=${validPage - 1}`}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Link>
            ) : (
              <span className="flex items-center justify-center gap-1">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </span>
            )}
          </Button>
          <span className="text-sm text-muted-foreground font-medium">
            Page {validPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={validPage >= totalPages}
            asChild={validPage < totalPages}
          >
            {validPage < totalPages ? (
              <Link href={`/notifications?page=${validPage + 1}`}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            ) : (
              <span className="flex items-center justify-center gap-1">
                Next
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
