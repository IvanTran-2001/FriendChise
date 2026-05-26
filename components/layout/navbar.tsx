/**
 * NavBar — top navigation bar (server component).
 *
 * Renders at `min-h-12` (48px) — the universal height unit used across the app.
 * Contains (left to right): hamburger trigger (mobile), logo, org switcher,
 * notification bell, and user avatar/dropdown.
 *
 * Notification data is fetched server-side on every render so the badge count
 * is always fresh without a client-side polling loop.
 *
 * Org list for the switcher is fetched via `Membership` rows and filtered for
 * null organizations (can occur when an org is soft-deleted or FK constraint
 * allows null) before sorting alphabetically.
 */
import { auth, signOut } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPublicUrl } from "@/lib/supabase-storage";
import { Button } from "@/components/ui/button";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { MobileSidebarTrigger } from "@/components/layout/sidebar";
import { Logo } from "@/components/layout/logo";
import { NotificationPanel } from "@/components/notifications";
import { FeedbackButton } from "@/components/layout/feedback-button";
import {
  getInvitesForUser,
  getUnseenInviteCount,
  getNotificationsForUser,
  getUnseenNotificationCount,
} from "@/lib/services/invites";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Top navigation bar, rendered as a server component so it can fetch
 * session and org data directly without client-side loading states.
 *
 * Left side:  sidebar toggle | App home link | org switcher dropdown
 * Right side: notification bell | user avatar dropdown
 */
export const NavBar = async () => {
  // Fetch the current session — user is null when signed out
  const session = await auth();
  const user = session?.user;

  // Fetch all orgs the current user is a member of, sorted alphabetically.
  // Used to populate the OrgSwitcher dropdown.
  const orgs = user?.id
    ? await prisma.membership
        .findMany({
          where: { userId: user.id },
          select: {
            organization: { select: { id: true, name: true, image: true } },
          },
        })
        .then((ms) =>
          ms
            .map((m) => m.organization)
            .filter((org) => org !== null)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((org) => ({
              ...org,
              image: org.image ? getPublicUrl(org.image) : null,
            })),
        )
        .catch((error) => {
          console.error("Failed to load organizations for navbar", error);
          return [];
        })
    : [];

  const [invites, unseenCount, notifications, unseenNotifCount] = user?.id
    ? await Promise.all([
        getInvitesForUser(user.id),
        getUnseenInviteCount(user.id),
        getNotificationsForUser(user.id),
        getUnseenNotificationCount(user.id),
      ]).catch((error) => {
        console.error("Failed to load invites for navbar", error);
        return [[], 0, [], 0] as [never[], number, never[], number];
      })
    : [[], 0, [], 0];

  return (
    <header
      className="sticky top-0 z-20 min-h-12 border-b border-border bg-card flex items-end justify-between pr-4 pl-0 pb-0"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* inner row always 3rem (h-12) tall */}
      <div className="flex w-full items-center justify-between h-12">
        {/* Left: logo + mobile menu trigger + org switcher */}
        <div className="flex items-center gap-2 min-w-0 pl-3 md:pl-0">
          <Button
            variant="ghost"
            asChild
            className="h-auto px-2 py-1.5 rounded-md hidden md:flex hover:bg-accent hover:text-foreground transition-colors"
          >
            <Link href="/">
              <Logo className="text-current" />
            </Link>
          </Button>
          <MobileSidebarTrigger />
          <OrgSwitcher orgs={orgs} />
        </div>

        {/* Right: notifications and user menu */}
        <div className="flex items-center gap-2">
          {/* Feedback */}
          <FeedbackButton />

          {/* Notification bell */}
          <NotificationPanel
            invites={invites}
            unseenCount={unseenCount + unseenNotifCount}
            notifications={notifications}
          />

          {/* User avatar — only rendered when a user is signed in */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* Shows profile image if available, otherwise falls back to first initial */}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open user menu"
                  className="h-9 w-9 rounded-full hover:bg-accent p-0 flex items-center justify-center"
                >
                  <div className="h-7 w-7 rounded-full bg-primary hover:bg-primary/90 overflow-hidden flex items-center justify-center">
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name ?? "User"}
                        width={28}
                        height={28}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-primary-foreground">
                        {user.name?.[0]?.toUpperCase() ?? "?"}
                      </span>
                    )}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium leading-none truncate">{user.name ?? "Profile"}</p>
                  {user.email && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{user.email}</p>
                  )}
                </div>
                <DropdownMenuSeparator />
                {/* TODO: restore <DropdownMenuItem asChild><Link href="/profile">Profile</Link></DropdownMenuItem> when profile page is implemented */}
                <DropdownMenuItem disabled>Profile</DropdownMenuItem>
                {/* TODO: restore <DropdownMenuItem asChild><Link href="/settings/account">Account Settings</Link></DropdownMenuItem> when account settings page is implemented */}
                <DropdownMenuItem disabled>Account Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* Sign out uses a server action so no client JS is needed */}
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/signin" });
                  }}
                >
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full text-left">
                      Sign out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
};
