import { auth, signOut } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import {
  NavbarSidebarTrigger,
  NavbarLogo,
  NavbarLogoSpacer,
} from "@/components/layout/navbar-sidebar-trigger";
import { NotificationPanel } from "@/components/layout/notification-panel";
import {
  getInvitesForUser,
  getUnseenInviteCount,
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

  const [invites, unseenCount] = user?.id
    ? await Promise.all([
        getInvitesForUser(user.id),
        getUnseenInviteCount(user.id),
      ]).catch((error) => {
        console.error("Failed to load invites for navbar", error);
        return [[], 0] as [never[], number];
      })
    : [[], 0];

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
      {/* Left: sidebar toggle, app title, org switcher */}
      <div className="flex items-center gap-2 min-w-0">
        <NavbarSidebarTrigger />
        <span className="hidden sm:contents">
          <NavbarLogo />
          <NavbarLogoSpacer />
        </span>
        <OrgSwitcher orgs={orgs} />
      </div>

      {/* Right: notifications and user menu */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <NotificationPanel invites={invites} unseenCount={unseenCount} />

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
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>{user.name ?? "Profile"}</DropdownMenuLabel>
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal -mt-2 truncate">
                {user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/account">Account Settings</Link>
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
    </header>
  );
};