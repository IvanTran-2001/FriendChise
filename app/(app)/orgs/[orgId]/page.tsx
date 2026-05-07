import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ListTodo, Users, ShieldCheck, Settings, MapPin, Clock, ArrowRight } from "lucide-react";
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
  return `${(h % 12 || 12)}:${String(m).padStart(2, "0")}${ampm}`;
}

function statusDotClass(s: string) {
  switch (s) {
    case "IN_PROGRESS": return "bg-amber-400";
    case "DONE": return "bg-green-500";
    case "SKIPPED": return "bg-red-400";
    default: return "bg-slate-400";
  }
}

function statusLabel(s: string) {
  switch (s) {
    case "IN_PROGRESS": return "In progress";
    case "DONE": return "Done";
    case "SKIPPED": return "Skipped";
    default: return "To do";
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
  const todayInstances = await getRangeTimetableInstances(orgId, org.timezone, todayStr, 1);

  const doneToday = todayInstances.filter((i) => i.status === "DONE" || i.status === "SKIPPED").length;
  const isOwner = org.ownerId === userId;

  const stats = [
    { label: "Members", value: org._count.memberships, href: `/orgs/${orgId}/memberships`, icon: Users },
    { label: "Tasks", value: org._count.tasks, href: `/orgs/${orgId}/tasks`, icon: ListTodo },
    { label: "Roles", value: org._count.roles, href: `/orgs/${orgId}/settings/roles`, icon: ShieldCheck },
    { label: "Today", value: `${doneToday} / ${todayInstances.length}`, href: `/orgs/${orgId}/timetable`, icon: Calendar, sub: "done" },
  ];

  return (
    <>
      <div className="max-w-3xl mx-auto w-full rounded-2xl border bg-card shadow-sm p-6 sm:p-8">
        {/* Org header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="font-heading text-2xl tracking-tight">{org.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
              {org.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {org.address}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {org.timezone.replace(/_/g, " ")}
              </span>
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

        {/* Today's schedule */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Today&apos;s Schedule</h2>
            <Link href={`/orgs/${orgId}/timetable`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Full timetable →
            </Link>
          </div>

          {todayInstances.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 py-10 flex flex-col items-center gap-2 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nothing scheduled today</p>
            </div>
          ) : (
            <div className="rounded-xl border divide-y overflow-hidden">
              {todayInstances
                .slice()
                .sort((a, b) => a.startTimeMin - b.startTimeMin)
                .map((inst) => (
                  <div
                    key={inst.id}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3",
                      inst.status === "DONE" || inst.status === "SKIPPED" ? "opacity-50" : "",
                    )}
                  >
                    {/* Color dot */}
                    {inst.taskColor ? (
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: inst.taskColor }} />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-muted-foreground/30" />
                    )}

                    {/* Time */}
                    <span className="text-xs text-muted-foreground w-14 shrink-0 tabular-nums">
                      {minTo12h(inst.startTimeMin)}
                    </span>

                    {/* Title */}
                    <span className="flex-1 text-sm truncate">{inst.task.title}</span>

                    {/* Status */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={cn("w-1.5 h-1.5 rounded-full", statusDotClass(inst.status))} />
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {statusLabel(inst.status)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Page;
