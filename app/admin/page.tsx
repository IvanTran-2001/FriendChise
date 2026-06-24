import Link from "next/link";
import { FeedbackType } from "@prisma/client";
import {
  ArrowRight,
  CheckCheck,
  ImageIcon,
  LineChart,
  Lightbulb,
  MessageSquareWarning,
  ShieldAlert,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isDemoEmail } from "@/lib/demo";
import { requireSuperAdminPage } from "@/lib/authz";
import { getAllFeedback } from "@/lib/services/feedback";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminHomePage() {
  await requireSuperAdminPage();

  const [feedback, users, demoLaunchesResult] = await Promise.all([
    getAllFeedback(),
    prisma.user.findMany({
      select: {
        createdAt: true,
        email: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM "DemoSession"
    `,
  ]);
  const demoLaunches = demoLaunchesResult[0]?.count ?? 0;
  const unreviewed = feedback.filter((item) => !item.reviewed);
  const issues = feedback.filter((item) => item.type === FeedbackType.ISSUE);
  const ideas = feedback.filter((item) => item.type === FeedbackType.IDEA);
  const nonDemoUsers = users.filter((user) => !isDemoEmail(user.email));
  const latestSignup = nonDemoUsers.at(-1)?.createdAt;
  const latestSignupLabel = latestSignup
    ? latestSignup.toLocaleDateString("en-AU", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "No signups yet";

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
        <CardHeader className="gap-3 border-b border-border/60 bg-muted/30">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <ShieldAlert className="h-3.5 w-3.5" />
            Admin overview
          </div>
          <CardTitle className="text-2xl sm:text-3xl">What needs attention</CardTitle>
          <CardDescription className="max-w-2xl text-sm sm:text-base">
            Feedback is the live admin workflow right now. Use the inbox to review
            screenshots, toggle items as reviewed, and keep the team looped in.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Total feedback
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{feedback.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">All submissions in the system.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Unreviewed
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{unreviewed.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Items still waiting on a pass.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Review mix
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {issues.length} / {ideas.length}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Issues vs ideas.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
          <CardHeader className="gap-3 border-b border-border/60 bg-muted/30">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <LineChart className="h-3.5 w-3.5" />
              User growth
            </div>
            <CardTitle className="text-2xl sm:text-3xl">Signup trend</CardTitle>
            <CardDescription className="max-w-2xl text-sm sm:text-base">
              The interactive growth chart now lives on its own page so the
              dashboard can stay focused on a quick admin overview.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Total users
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{nonDemoUsers.length}</p>
              <p className="mt-1 text-sm text-muted-foreground">All non-demo accounts.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Demo launches
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{demoLaunches}</p>
              <p className="mt-1 text-sm text-muted-foreground">Counted from persistent demo-session records.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Latest signup
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-tight">{latestSignupLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">Newest non-demo account creation date.</p>
            </div>
            <Button asChild className="w-full justify-between sm:col-span-3">
              <Link href="/admin/growth">
                Open growth page
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquareWarning className="h-4 w-4 text-primary" />
                Feedback inbox
              </CardTitle>
              <CardDescription>
                Open the moderation queue and review items one by one.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{unreviewed.length} unreviewed</p>
                  <p className="text-xs text-muted-foreground">
                    {feedback.length} total submissions
                  </p>
                </div>
                <CheckCheck className="h-5 w-5 text-emerald-500" />
              </div>

              <Button asChild className="w-full justify-between">
                <Link href="/admin/feedback">
                  Go to feedback
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button variant="outline" asChild className="w-full justify-between">
                <Link href="/admin/photos">
                  View photos
                  <ImageIcon className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                What’s live
              </CardTitle>
              <CardDescription>
                The admin area is intentionally small for now.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Feedback inbox with screenshots</p>
              <p>• Photos browser for logos, gallery images, and feedback images</p>
              <p>• Review / unreview toggle</p>
              <p>• More admin sections can be added beside it later</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}