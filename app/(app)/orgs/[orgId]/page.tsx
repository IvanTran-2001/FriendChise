import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar,
  ListTodo,
  Users,
  ShieldCheck,
  Settings,
  MapPin,
  Clock,
  Globe,
  ArrowRight,
  ArrowLeftRight,
} from "lucide-react";

// ─── org color ────────────────────────────────────────────────────────────────

const ORG_COLOR_PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

function orgColor(name: string): string {
  const sum = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return ORG_COLOR_PALETTE[sum % ORG_COLOR_PALETTE.length];
}
import { requireOrgMemberPage } from "@/lib/authz";
import { getAuthUserId } from "@/lib/authz/_shared";
import { prisma } from "@/lib/prisma";
import { getRangeTimetableInstances } from "@/lib/services/timetable-entries";
import { toLocalDateStr } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

// ─── helpers ─────────────────────────────────────────────────────────────────

function minTo12h(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h < 12 ? "am" : "pm";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${ampm}`;
}

function statusDotClass(s: string) {
  switch (s) {
    case "IN_PROGRESS":
      return "bg-amber-400";
    case "DONE":
      return "bg-green-500";
    case "SKIPPED":
      return "bg-red-400";
    default:
      return "bg-slate-400";
  }
}

function statusLabel(s: string) {
  switch (s) {
    case "IN_PROGRESS":
      return "In progress";
    case "DONE":
      return "Done";
    case "SKIPPED":
      return "Skipped";
    default:
      return "To do";
  }
}

// ─── page ─────────────────────────────────────────────────────────────────────

const Page = async ({ params }: { params: Promise<{ orgId: string }> }) => {
  const { orgId } = await params;
  await requireOrgMemberPage(orgId);

  const userId = await getAuthUserId();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true,
      address: true,
      timezone: true,
      ownerId: true,
      openTimeMin: true,
      closeTimeMin: true,
      _count: {
        select: {
          memberships: { where: { userId: { not: null } } },
          tasks: true,
          roles: true,
        },
      },
    },
  });
  if (!org) notFound();

  const todayStr = toLocalDateStr(new Date(), org.timezone);
  const [todayInstances, recentSets] = await Promise.all([
    getRangeTimetableInstances(orgId, org.timezone, todayStr, 1),
    prisma.conversionSet.findMany({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, name: true, updatedAt: true },
    }),
  ]);

  const doneToday = todayInstances.filter(
    (i) => i.status === "DONE" || i.status === "SKIPPED",
  ).length;
  const isOwner = org.ownerId === userId;

  const stats = [
    {
      label: "Members",
      value: org._count.memberships,
      href: `/orgs/${orgId}/memberships`,
      icon: Users,
    },
    {
      label: "Tasks",
      value: org._count.tasks,
      href: `/orgs/${orgId}/tasks`,
      icon: ListTodo,
    },
    {
      label: "Roles",
      value: org._count.roles,
      href: `/orgs/${orgId}/settings/roles`,
      icon: ShieldCheck,
    },
    {
      label: "Today",
      value: `${doneToday} / ${todayInstances.length}`,
      href: `/orgs/${orgId}/timetable`,
      icon: Calendar,
      sub: "done",
    },
  ];

  return (
    <>
      <div className="max-w-3xl mx-auto w-full rounded-2xl border bg-card shadow-sm">
        {/* Color accent bar */}
        <div
          className="h-1.5 rounded-t-2xl"
          style={{ backgroundColor: orgColor(org.name) }}
        />
        <div className="p-6 sm:p-8">
        {/* Org header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-heading text-2xl tracking-tight">{org.name}</h1>
              {isOwner && (
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                  Owner
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
              {org.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {org.address}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                {org.timezone.replace(/_/g, " ")}
              </span>
              {org.openTimeMin != null && org.closeTimeMin != null && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {minTo12h(org.openTimeMin)} – {minTo12h(org.closeTimeMin)}
                </span>
              )}
            </div>
          </div>
          {isOwner && (
            <Link
              href={`/orgs/${orgId}/settings/organization`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {stats.map(({ label, value, href, icon: Icon, sub }) => (
            <Link
              key={label}
              href={href}
              className="group flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <Icon className="h-4 w-4" />
                <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-2xl font-semibold mt-1">{value}</p>
              <p className="text-xs text-muted-foreground">{sub ?? label}</p>
            </Link>
          ))}
        </div>

        {/* Roster feature card — always visible */}
        <Link
          href={`/orgs/${orgId}/tools/roster`}
          className="group flex items-center gap-4 rounded-xl border bg-card px-5 py-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all mb-8"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
            <Users className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug">Roster</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your weekly staff roster
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
        </Link>

        {/* Recent Tools */}
        {recentSets.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Recent Tools</h2>
              <Link
                href={`/orgs/${orgId}/tools`}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                All tools →
              </Link>
            </div>
            <div className="max-h-44 overflow-y-auto rounded-xl border divide-y">
              {recentSets.map((s) => (
                <Link
                  key={s.id}
                  href={`/orgs/${orgId}/tools/conversion/${s.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-sm truncate">{s.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {s.updatedAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Today's schedule */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Today&apos;s Schedule</h2>
            <Link
              href={`/orgs/${orgId}/timetable`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Full timetable →
            </Link>
          </div>

          {todayInstances.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 py-10 flex flex-col items-center gap-2 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Nothing scheduled today
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{doneToday} of {todayInstances.length} done</span>
                  <span>{Math.round((doneToday / todayInstances.length) * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(doneToday / todayInstances.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="rounded-xl border divide-y overflow-hidden">
              {todayInstances
                .slice()
                .sort((a, b) => a.startTimeMin - b.startTimeMin)
                .map((inst) => (
                  <div
                    key={inst.id}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3",
                      inst.status === "DONE" || inst.status === "SKIPPED"
                        ? "opacity-50"
                        : "",
                    )}
                  >
                    {/* Color dot */}
                    {inst.taskColor ? (
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: inst.taskColor }}
                      />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-muted-foreground/30" />
                    )}

                    {/* Time */}
                    <span className="text-xs text-muted-foreground w-14 shrink-0 tabular-nums">
                      {minTo12h(inst.startTimeMin)}
                    </span>

                    {/* Title */}
                    <span className="flex-1 text-sm truncate">
                      {inst.task.title}
                    </span>

                    {/* Status */}
                    <span
                      className={cn(
                        "hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0",
                        inst.status === "IN_PROGRESS"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : inst.status === "DONE"
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : inst.status === "SKIPPED"
                          ? "bg-red-500/10 text-red-500"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {statusLabel(inst.status)}
                    </span>
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0 sm:hidden",
                        statusDotClass(inst.status),
                      )}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        </div>
      </div>
    </>
  );
};

export default Page;
