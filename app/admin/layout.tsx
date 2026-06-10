import Link from "next/link";
import { ArrowLeft, ImageIcon, Shield, MessageSquareMore, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-linear-to-br from-violet-500/10 via-background to-sky-500/10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">
            <div className="flex flex-1 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  FriendChise Admin
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Admin panel
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Development-only admin tools. Feedback and photos are the two
                  main views for now.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button variant="outline" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                  Back to app
                </Link>
              </Button>
              <Button asChild>
                <Link href="/admin/feedback">
                  <MessageSquareMore className="h-4 w-4" />
                  Open feedback
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card className="border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
              <CardHeader className="gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PanelLeft className="h-4 w-4 text-primary" />
                  Navigation
                </CardTitle>
                <CardDescription>
                  Jump between the admin overview, feedback, and photos.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button variant="outline" asChild className="justify-start">
                  <Link href="/admin">Overview</Link>
                </Button>
                <Button variant="outline" asChild className="justify-start">
                  <Link href="/admin/feedback">Feedback</Link>
                </Button>
                <Button variant="outline" asChild className="justify-start">
                  <Link href="/admin/photos">
                    <ImageIcon className="h-4 w-4" />
                    Photos
                  </Link>
                </Button>
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

          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}