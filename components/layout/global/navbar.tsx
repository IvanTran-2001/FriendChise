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
import { isAdminUser } from "@/lib/authz";
import { Button } from "@/components/ui/button";
import { OrgSwitcher } from "@/components/layout/global/org-switcher";
import { MobileSidebarTrigger } from "@/components/layout/sidebar/sidebar";
import { Logo } from "@/components/layout/global/logo";
import { NotificationPanel } from "@/components/notifications";
import { FeedbackButton } from "@/components/layout/global/feedback-button";
import { getNotificationFeedForUser } from "@/lib/services/notification-feed";
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
  const limit = 7;


  const [allNotificationFeed, unseenNotificationFeed] = user?.id
    ? await Promise.all([
        getNotificationFeedForUser(user.id, 1, limit),
        getNotificationFeedForUser(user.id, 1, limit, { view: "unseen" }),
      ]).catch((error) => {
        console.error("Failed to load notifications for navbar", error);
        return [
          { items: [], totalCount: 0, totalPages: 1, page: 1, pageSize: 0 },
          { items: [], totalCount: 0, totalPages: 1, page: 1, pageSize: 0 },
        ] as [
          { items: never[]; totalCount: number; totalPages: number; page: number; pageSize: number },
          { items: never[]; totalCount: number; totalPages: number; page: number; pageSize: number },
        ];
      })
    : [{ items: [], totalCount: 0, totalPages: 1, page: 1, pageSize: 0 }, { items: [], totalCount: 0, totalPages: 1, page: 1, pageSize: 0 }];

  const canAccessAdmin = user?.email ? await isAdminUser(user.email) : false;

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 md:sticky md:inset-auto md:top-0 md:z-20 border-b border-border/60 bg-card/85 backdrop-blur-xl supports-backdrop-filter:bg-card/70"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      data-tour-target="topbar"
    >
      <div className="flex h-14 w-full items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
        {/* Left: branded home link + mobile menu trigger + org switcher */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            asChild
            className="hidden md:flex h-9 shrink-0 items-center rounded-full border border-border/60 bg-background/85 px-2 pl-1.25 pr-2.5 text-foreground transition-colors duration-150 hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
          >
            <Link
              href="/"
              aria-label="Go to home"
              className="flex items-center gap-1.5"
            >
              <Logo />
              <span className="hidden xl:flex flex-col items-start leading-none">
                <span className="text-[13px] font-semibold tracking-tight text-foreground/90">
                  FriendChise
                </span>
                <span
                  className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  style={{ marginTop: 1 }}
                >
                  Home
                </span>
              </span>
            </Link>
          </Button>
          <MobileSidebarTrigger />
          <div className="min-w-0" data-tour-target="org-switcher">
            <OrgSwitcher />
          </div>
        </div>

        {/* Right: quick actions and user menu */}
        <div className="flex items-center gap-1.5 sm:gap-2" data-tour-target="top-actions">
          {canAccessAdmin && (
            <Button
              variant="outline"
              asChild
              className="hidden sm:flex h-9 rounded-full px-3 text-xs font-semibold"
            >
              <Link href="/admin" aria-label="Open admin panel">
                Admin
              </Link>
            </Button>
          )}
          <FeedbackButton />
          {/* Notification bell */}
          <NotificationPanel
            items={allNotificationFeed.items}
            unseenItems={unseenNotificationFeed.items}
            unseenCount={unseenNotificationFeed.totalCount}
          />

          {user && (
            <span className="mx-0.5 hidden h-6 w-px bg-border/60 sm:block" aria-hidden />
          )}

          {/* User avatar — only rendered when a user is signed in */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* Shows profile image if available, otherwise falls back to first initial */}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open user menu"
                  className="h-9 w-9 rounded-full border border-border/60 bg-background/85 p-0 transition-colors duration-150 hover:border-border hover:bg-muted/60"
                >
                  <div className="h-7 w-7 rounded-full bg-primary overflow-hidden flex items-center justify-center">
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
                  <p className="text-sm font-medium leading-none truncate">
                    {user.name ?? "Profile"}
                  </p>
                  {user.email && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {user.email}
                    </p>
                  )}
                </div>
                <DropdownMenuSeparator />
                {canAccessAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">Admin panel</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/account">Account Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/doc/overview">Docs</Link>
                </DropdownMenuItem>
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
