import { auth, signOut } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { NavbarContextActions } from "@/components/layout/navbar-context-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const NavBar = async () => {
  const session = await auth();
  const user = session?.user;

  const orgs = user?.id
    ? await prisma.membership
        .findMany({
          where: { userId: user.id },
          select: { org: { select: { id: true, title: true } } },
        })
        .then((ms) =>
          ms.map((m) => m.org).sort((a, b) => a.title.localeCompare(b.title)),
        )
    : [];

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <OrgSwitcher orgs={orgs} />
        <NavbarContextActions />
      </div>

      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/orgs/new">+ New Org</Link>
        </Button>
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name ?? "User"}
                    width={24}
                    height={24}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {user.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <span className="hidden sm:inline">{user.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal truncate">
                {user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
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
