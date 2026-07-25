"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Menu, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/dialogs/sheet";
import { AdminNavTabs } from "./admin-nav-tabs";

export function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Auto-close mobile sheet drawer on path change
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleClose = React.useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-linear-to-br from-violet-500/10 via-background to-sky-500/10">
      {/* Top Navbar */}
      <header className="z-20 border-b border-border/70 bg-card/90 px-4 py-3 shadow-sm backdrop-blur-xl shrink-0 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Trigger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden shrink-0">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-6 flex flex-col gap-6" showCloseButton>
                <SheetHeader className="p-0 text-left">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                      <Shield className="h-4 w-4" />
                    </div>
                    <SheetTitle className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      FriendChise Admin
                    </SheetTitle>
                  </div>
                </SheetHeader>

                {/* Navigation inside mobile menu */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
                      Navigation
                    </p>
                    <AdminNavTabs onItemClick={handleClose} />
                  </div>

                  <Card className="border-border/70 bg-card/90 shadow-sm mt-4">
                    <CardHeader className="gap-2 p-4">
                      <CardTitle className="text-sm">Quick note</CardTitle>
                      <CardDescription className="text-xs">
                        The admin area is dev-only. In production, the real admin check
                        still applies.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              </SheetContent>
            </Sheet>

            {/* Shield Icon & Title */}
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  FriendChise Admin
                </p>
                <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-border" />
                <h1 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  Admin panel
                </h1>
              </div>
              <p className="hidden md:block text-xs text-muted-foreground mt-0.5">
                Development-only admin tools. Growth, feedback, and photos are the main views for now.
              </p>
            </div>
          </div>

          {/* Back to App Link */}
          <div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to app</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content Area with Desktop Sidebar */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="mx-auto flex h-full w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8 overflow-hidden">
          {/* Desktop Sticky Sidebar */}
          <aside className="hidden lg:flex flex-col gap-4 w-80 shrink-0 overflow-y-auto pr-1">
            <Card className="border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
              <CardHeader className="gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4 text-primary" />
                  Navigation
                </CardTitle>
                <CardDescription>
                  Jump between the admin overview, growth, feedback, and photos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminNavTabs />
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
              <CardHeader className="gap-2">
                <CardTitle className="text-base">Quick note</CardTitle>
                <CardDescription>
                  The admin area is dev-only. In production, the real admin check
                  still applies.
                </CardDescription>
              </CardHeader>
            </Card>
          </aside>

          {/* Scrollable Page Content */}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pb-2 pr-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
