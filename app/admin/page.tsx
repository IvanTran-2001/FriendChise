import Link from "next/link";
<<<<<<< HEAD
import { Prisma, FeedbackType } from "@prisma/client";
import {
  ArrowRight,
  CheckCheck,
  ImageIcon,
  Lightbulb,
  MessageSquareWarning,
  ShieldAlert,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
=======
import { FeedbackType } from "@prisma/client";
import { ArrowRight, CheckCheck, ImageIcon, Lightbulb, MessageSquareWarning, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isDemoEmail } from "@/lib/demo";
>>>>>>> origin/master
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
<<<<<<< HEAD
import {
  AdminUserGrowthCard,
  type UserGrowthByRange,
} from "./_components/admin-user-growth-card";

type BucketRow = {
  bucket: Date;
  total: bigint;
  demo: bigint;
};

type RangeKey = "day" | "7d" | "month" | "6m" | "year" | "lifetime";

type GrowthBucket = {
  key: string;
  label: string;
  total: number;
  demo: number;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfHour(date: Date) {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  return next;
}

function startOfMonth(date: Date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function bucketKey(date: Date, granularity: "hour" | "day" | "month") {
  if (granularity === "hour") {
    return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCHours()}`;
  }
  if (granularity === "day") {
    return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  }
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
}

function formatHourLabel(date: Date) {
  return date
    .toLocaleTimeString("en-AU", { hour: "numeric", timeZone: "UTC" })
    .replace(/^0/, "");
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatMonthLabel(date: Date, long = false) {
  return date.toLocaleDateString("en-AU", {
    month: "short",
    year: long ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

function fillSeries(
  buckets: GrowthBucket[],
  rows: BucketRow[],
  granularity: "hour" | "day" | "month",
) {
  const rowMap = new Map(
    rows.map((row) => [
      bucketKey(new Date(row.bucket), granularity),
      {
        total: Number(row.total),
        demo: Number(row.demo),
      },
    ]),
  );

  return buckets.map((bucket) => {
    const row = rowMap.get(bucket.key);
    return row
      ? {
          ...bucket,
          total: row.total,
          demo: row.demo,
        }
      : bucket;
  });
}

function buildGrowthSeries(
  hourlyRows: BucketRow[],
  dailyRows: BucketRow[],
  monthlyRows: BucketRow[],
): UserGrowthByRange {
  const now = new Date();

  const dayBuckets: GrowthBucket[] = Array.from({ length: 24 }, (_, index) => {
    const bucketStart = addHours(startOfHour(addHours(now, -23)), index);
    return {
      key: bucketKey(bucketStart, "hour"),
      label: formatHourLabel(bucketStart),
      total: 0,
      demo: 0,
    };
  });

  const sevenDayBuckets: GrowthBucket[] = Array.from(
    { length: 7 },
    (_, index) => {
      const bucketStart = addDays(startOfDay(addDays(now, -6)), index);
      return {
        key: bucketKey(bucketStart, "day"),
        label: formatDayLabel(bucketStart),
        total: 0,
        demo: 0,
      };
    },
  );

  const monthBuckets: GrowthBucket[] = Array.from(
    { length: 30 },
    (_, index) => {
      const bucketStart = addDays(startOfDay(addDays(now, -29)), index);
      return {
        key: bucketKey(bucketStart, "day"),
        label: formatDayLabel(bucketStart),
        total: 0,
        demo: 0,
      };
    },
  );

  const sixMonthBuckets: GrowthBucket[] = Array.from(
    { length: 6 },
    (_, index) => {
      const bucketStart = addMonths(startOfMonth(addMonths(now, -5)), index);
      return {
        key: bucketKey(bucketStart, "month"),
        label: formatMonthLabel(bucketStart),
        total: 0,
        demo: 0,
      };
    },
  );

  const yearBuckets: GrowthBucket[] = Array.from({ length: 12 }, (_, index) => {
    const bucketStart = addMonths(startOfMonth(addMonths(now, -11)), index);
    return {
      key: bucketKey(bucketStart, "month"),
      label: formatMonthLabel(bucketStart),
      total: 0,
      demo: 0,
    };
  });

  const firstMonthlyRow = monthlyRows[0];
  const lifetimeStart = firstMonthlyRow
    ? startOfMonth(new Date(firstMonthlyRow.bucket))
    : startOfMonth(now);
  const lifetimeEnd = startOfMonth(now);
  const lifetimeBuckets: GrowthBucket[] = [];
  const cursor = new Date(lifetimeStart);

  while (cursor <= lifetimeEnd) {
    lifetimeBuckets.push({
      key: bucketKey(cursor, "month"),
      label: formatMonthLabel(cursor),
      total: 0,
      demo: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return {
    day: fillSeries(dayBuckets, hourlyRows, "hour"),
    "7d": fillSeries(sevenDayBuckets, dailyRows, "day"),
    month: fillSeries(monthBuckets, dailyRows, "day"),
    "6m": fillSeries(sixMonthBuckets, monthlyRows, "month"),
    year: fillSeries(yearBuckets, monthlyRows, "month"),
    lifetime: fillSeries(lifetimeBuckets, monthlyRows, "month"),
  } satisfies Record<RangeKey, GrowthBucket[]>;
}
=======
import { AdminUserGrowthCard, type UserGrowthRecord } from "./_components/admin-user-growth-card";
>>>>>>> origin/master

export default async function AdminHomePage() {
  await requireSuperAdminPage();

<<<<<<< HEAD
  const [feedback, hourlyRows, dailyRows, monthlyRows] = await Promise.all([
    getAllFeedback(),
    prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      SELECT
        date_trunc('hour', "createdAt") AS bucket,
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE "email" LIKE '%@demo.friendchise.app')::bigint AS demo
      FROM "User"
      WHERE "createdAt" >= NOW() - INTERVAL '24 hours'
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', "createdAt") AS bucket,
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE "email" LIKE '%@demo.friendchise.app')::bigint AS demo
      FROM "User"
      WHERE "createdAt" >= NOW() - INTERVAL '29 days'
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      SELECT
        date_trunc('month', "createdAt") AS bucket,
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE "email" LIKE '%@demo.friendchise.app')::bigint AS demo
      FROM "User"
      GROUP BY 1
      ORDER BY 1 ASC
    `),
=======
  const [feedback, users] = await Promise.all([
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
>>>>>>> origin/master
  ]);
  const unreviewed = feedback.filter((item) => !item.reviewed);
  const issues = feedback.filter((item) => item.type === FeedbackType.ISSUE);
  const ideas = feedback.filter((item) => item.type === FeedbackType.IDEA);
<<<<<<< HEAD
  const userGrowthSeries = buildGrowthSeries(
    hourlyRows,
    dailyRows,
    monthlyRows,
  );
  const lifetimeTotal = monthlyRows.reduce(
    (sum, row) => sum + Number(row.total),
    0,
  );

  return (
    <div className="grid gap-6">
      <AdminUserGrowthCard
        series={userGrowthSeries}
        lifetimeTotal={lifetimeTotal}
      />
=======
  const userGrowthRecords: UserGrowthRecord[] = users.map((user) => ({
    createdAt: user.createdAt.toISOString(),
    isDemo: isDemoEmail(user.email),
  }));

  return (
    <div className="grid gap-6">
      <AdminUserGrowthCard records={userGrowthRecords} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
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
>>>>>>> origin/master

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
          <CardHeader className="gap-3 border-b border-border/60 bg-muted/30">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <ShieldAlert className="h-3.5 w-3.5" />
              Admin overview
            </div>
            <CardTitle className="text-2xl sm:text-3xl">
              What needs attention
            </CardTitle>
            <CardDescription className="max-w-2xl text-sm sm:text-base">
              Feedback is the live admin workflow right now. Use the inbox to
              review screenshots, toggle items as reviewed, and keep the team
              looped in.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Total feedback
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {feedback.length}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                All submissions in the system.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Unreviewed
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {unreviewed.length}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Items still waiting on a pass.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Review mix
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {issues.length} / {ideas.length}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Issues vs ideas.
              </p>
            </div>
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
                  <p className="text-sm font-medium">
                    {unreviewed.length} unreviewed
                  </p>
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

              <Button
                variant="outline"
                asChild
                className="w-full justify-between"
              >
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
              <p>
                • Photos browser for logos, gallery images, and feedback images
              </p>
              <p>• Review / unreview toggle</p>
              <p>• More admin sections can be added beside it later</p>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}
