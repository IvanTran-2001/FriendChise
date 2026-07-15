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
  LayoutList,
} from "lucide-react";
import { orgColor } from "@/lib/org-color";
import { requireOrgMemberPage } from "@/lib/authz";
import { getAuthUserId } from "@/lib/authz/_shared";
import { prisma } from "@/lib/prisma";
import { getRangeTimetableInstances } from "@/lib/services/timetable-entries";
import {
  listRecentActivitiesByCategories,
  RECENT_ACTIVITY_CATEGORY,
  type RecentActivityRecord,
} from "@/lib/services/recent-activity";
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

type RecentWorkItem = {
  id: string;
  name: string;
  updatedAt: Date;
  category: string;
  href: string;
};

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
  const [todayInstances, recentActivity, fallbackSets] = await Promise.all([
    getRangeTimetableInstances(orgId, org.timezone, todayStr, 1),
    listRecentActivitiesByCategories(
      orgId,
      [RECENT_ACTIVITY_CATEGORY.TOOLS, RECENT_ACTIVITY_CATEGORY.ITEM_LISTS],
      10,
    ),
    prisma.conversionSet.findMany({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, name: true, updatedAt: true },
    }),
  ]);

  const typedRecentActivity: RecentActivityRecord[] = recentActivity;
  const recentSets: RecentWorkItem[] =
    typedRecentActivity.length > 0
      ? typedRecentActivity.map((item: RecentActivityRecord): RecentWorkItem => ({
          id: item.entityKey,
          name: item.entityName,
          updatedAt: item.lastUsedAt,
          category: item.category,
          href: item.entityHref ?? (item.category === 'item-lists' ? `/orgs/${orgId}/tools/item-lists/${item.entityKey}` : `/orgs/${orgId}/tools/conversion/${item.entityKey}`),
        }))
      : fallbackSets.map((set: (typeof fallbackSets)[number]): RecentWorkItem => ({
          id: set.id,
          name: set.name,
          updatedAt: set.updatedAt,
          category: RECENT_ACTIVITY_CATEGORY.TOOLS,
          href: `/orgs/${orgId}/tools/conversion/${set.id}`,
        }));

  const doneToday = todayInstances.filter(
    (i: (typeof todayInstances)[number]) =>
      i.status === "DONE" || i.status === "SKIPPED",
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

  const quickLinks = [
    {
      label: "Tools hub",
      href: `/orgs/${orgId}/tools`,
      icon: ArrowLeftRight,
      description: "Open tools and conversion sets.",
      accent:
        "bg-sky-500/10 text-sky-700 ring-sky-500/15 dark:text-sky-300",
      bar: "bg-sky-500/70",
    },
    {
      label: "Roster",
      href: `/orgs/${orgId}/tools/roster`,
      icon: Users,
      description: "Manage the weekly roster.",
      accent:
        "bg-amber-500/10 text-amber-700 ring-amber-500/15 dark:text-amber-300",
      bar: "bg-amber-500/70",
    },
    {
      label: "Tasks",
      href: `/orgs/${orgId}/tasks`,
      icon: ListTodo,
      description: "Review active and shared work.",
      accent:
        "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15 dark:text-emerald-300",
      bar: "bg-emerald-500/70",
    },
    {
      label: "Timetable",
      href: `/orgs/${orgId}/timetable`,
      icon: Calendar,
      description: "See today’s schedule at a glance.",
      accent:
        "bg-violet-500/10 text-violet-700 ring-violet-500/15 dark:text-violet-300",
      bar: "bg-violet-500/70",
    },
    {
      label: "Members",
      href: `/orgs/${orgId}/memberships`,
      icon: Users,
      description: "Check the full team list.",
      accent:
        "bg-cyan-500/10 text-cyan-700 ring-cyan-500/15 dark:text-cyan-300",
      bar: "bg-cyan-500/70",
    },
    {
      label: "Settings",
      href: `/orgs/${orgId}/settings/organization`,
      icon: Settings,
      description: "Adjust org details and roles.",
      accent:
        "bg-slate-500/10 text-slate-700 ring-slate-500/15 dark:text-slate-300",
      bar: "bg-slate-500/70",
    },
  ];

  return (
    <>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6">
        <section className="overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div
            className="h-1.5 rounded-full"
            style={{ backgroundColor: orgColor(org.name) }}
          />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                  Org overview
                </span>
                {isOwner && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Owner
                  </span>
                )}
              </div>
              <h1
                className="mt-2 text-2xl font-semibold tracking-tight sm:mt-3 sm:text-4xl"
                data-org-name={org.name}
              >
                {org.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:mt-3 sm:text-base">
                Jump into tools, sets, tasks, roster, or today&apos;s schedule without
                hunting through the app.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {org.address && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 shadow-sm">
                    <MapPin className="h-3.5 w-3.5" />
                    {org.address}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 shadow-sm">
                  <Globe className="h-3.5 w-3.5" />
                  {org.timezone.replace(/_/g, " ")}
                </span>
                {org.openTimeMin != null && org.closeTimeMin != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 shadow-sm">
                    <Clock className="h-3.5 w-3.5" />
                    {minTo12h(org.openTimeMin)} – {minTo12h(org.closeTimeMin)}
                  </span>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={`/orgs/${orgId}/tools`}
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
                >
                  Open tools
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={`/orgs/${orgId}/timetable`}
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
                >
                  View timetable
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {isOwner && (
                  <Link
                    href={`/orgs/${orgId}/settings/organization`}
                    className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
                  >
                    Settings
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 lg:w-105 lg:grid-cols-2">
              {stats.map(({ label, value, href, icon: Icon, sub }) => (
                <Link
                  key={label}
                  href={href}
                  className="group min-w-0 rounded-2xl border border-border bg-background p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md sm:p-4"
                >
                  <div className="flex items-center justify-between text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <ArrowRight className="h-3 w-3 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 sm:h-3.5 sm:w-3.5" />
                  </div>
                  <p className="mt-2 truncate text-[0.95rem] font-semibold tabular-nums leading-none sm:text-2xl">
                    {value}
                  </p>
                  <p className="mt-1 truncate text-[9px] text-muted-foreground sm:text-xs">
                    {sub ?? label}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="px-1">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Quick access
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Go straight to the places people check most often.
            </p>
          </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${item.bar}`} />
                  <div className="flex items-start gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${item.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold sm:text-base">{item.label}</h3>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {recentSets.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Recent work
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Jump back into the most recently opened lists and conversion work.
                </p>
              </div>
              <Link
                href={`/orgs/${orgId}/tools`}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                All tools →
              </Link>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
              <Link
                href={`/orgs/${orgId}/tools/roster`}
                className="group relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-amber-500/70" />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/15 dark:text-amber-300">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Activity
                        </p>
                        <h3 className="mt-1 text-base font-semibold sm:text-lg">Roster</h3>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Manage team rosters, schedules, and activity in one place.
                    </p>
                  </div>
                </div>
              </Link>

              <div className="grid gap-3">
                {recentSets.map((s: (typeof recentSets)[number], index: number) => (
                  <Link
                    key={`${s.category}:${s.id}`}
                    href={s.href}
                    className="group relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <div
                      className={`absolute inset-x-0 top-0 h-1 ${
                        s.category === "item-lists"
                          ? "bg-emerald-500/70"
                          : index === 0
                          ? "bg-sky-500/70"
                          : index === 1
                            ? "bg-emerald-500/70"
                            : "bg-violet-500/70"
                      }`}
                    />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${
                          s.category === "item-lists"
                            ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15 dark:text-emerald-300"
                            : index === 0
                            ? "bg-sky-500/10 text-sky-700 ring-sky-500/15 dark:text-sky-300"
                            : index === 1
                              ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15 dark:text-emerald-300"
                              : "bg-violet-500/10 text-violet-700 ring-violet-500/15 dark:text-violet-300"
                        }`}
                      >
                        {s.category === "item-lists" ? (
                          <LayoutList className="h-5 w-5" />
                        ) : (
                          <ArrowLeftRight className="h-5 w-5" />
                        )}
                      </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              {s.category === "item-lists" ? "Recent list" : "Recent set"}
                            </p>
                            <h3 className="mt-1 truncate text-sm font-semibold sm:text-base">
                              {s.name}
                            </h3>
                          </div>
                          <span className="shrink-0 rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            {s.updatedAt.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                          <div className="mt-2 inline-flex rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            {s.category === "item-lists" ? "Item List" : "Conversion"}
                          </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Today&apos;s schedule
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Quickly see what&apos;s on deck and what&apos;s already complete.
              </p>
            </div>
            <Link
              href={`/orgs/${orgId}/timetable`}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Full timetable →
            </Link>
          </div>

          {todayInstances.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed bg-muted/20 py-10 flex flex-col items-center gap-2 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Nothing scheduled today
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 mb-3">
                <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {doneToday} of {todayInstances.length} done
                  </span>
                  <span>
                    {Math.round((doneToday / todayInstances.length) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${(doneToday / todayInstances.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border divide-y">
                {todayInstances
                  .slice()
                  .sort(
                    (a: (typeof todayInstances)[number], b: (typeof todayInstances)[number]) =>
                      a.startTimeMin - b.startTimeMin,
                  )
                  .map((inst: (typeof todayInstances)[number]) => (
                    <div
                      key={inst.id}
                      className={cn(
                        "flex items-center gap-4 px-4 py-3",
                        inst.status === "DONE" || inst.status === "SKIPPED"
                          ? "opacity-50"
                          : "",
                      )}
                    >
                      {inst.taskColor ? (
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: inst.taskColor }}
                        />
                      ) : (
                        <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/30" />
                      )}

                      <span className="w-14 shrink-0 tabular-nums text-xs text-muted-foreground">
                        {minTo12h(inst.startTimeMin)}
                      </span>

                      <span className="flex-1 truncate text-sm">
                        {inst.task.title}
                      </span>

                      <span
                        className={cn(
                          "hidden shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium sm:inline-flex",
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
                          "h-1.5 w-1.5 shrink-0 rounded-full sm:hidden",
                          statusDotClass(inst.status),
                        )}
                        aria-label={statusLabel(inst.status)}
                      />
                    </div>
                  ))}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
};

export default Page;
