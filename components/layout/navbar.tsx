import { auth, signOut } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { MobileSidebarTrigger } from "@/components/layout/sidebar";
import { Logo } from "@/components/layout/logo";
import { NotificationPanel } from "@/components/notifications";
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
  DropdownMenuLabel,
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
          select: { organization: { select: { id: true, name: true } } },
        })
        .then((ms) =>
          ms
            .map((m) => m.organization)
            .sort((a, b) => a.name.localeCompare(b.name)),
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
      className="sticky top-0 z-20 min-h-14 border-b border-border bg-card flex items-end justify-between pr-4 pl-0 pb-0"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* inner row always 3.5rem (h-14) tall */}
      <div className="flex w-full items-center justify-between h-14">
        {/* Left: logo + mobile menu trigger + org switcher */}
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" asChild className="h-auto px-2 py-1.5 rounded-md hidden md:flex">
            <Link href="/">
              <Logo className="text-foreground" />
            </Link>
          </Button>
          <MobileSidebarTrigger />
          <OrgSwitcher orgs={orgs} />
        </div>

        {/* Right: notifications and user menu */}
        <div className="flex items-center gap-2">
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
                  className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 overflow-hidden p-0 flex items-center justify-center"
                >
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt={user.name ?? "User"}
                      width={36}
                      height={36}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-primary-foreground">
                      {user.name?.[0]?.toUpperCase() ?? "?"}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{user.name ?? "Profile"}</DropdownMenuLabel>
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal -mt-2 w-full truncate block">
                  {user.email}
                </DropdownMenuLabel>
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
