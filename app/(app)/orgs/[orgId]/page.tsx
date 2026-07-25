import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock,
  Globe,
  LayoutList,
  ListTodo,
  MapPin,
  Megaphone,
  Settings,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { orgColor } from "@/lib/core/org-color";
import { requireOrgMemberPage } from "@/lib/authz";
import { getAuthUserId, getOrgMembership, memberHasPermission } from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import { prisma } from "@/lib/platform/prisma";
import { getRangeTimetableInstances } from "@/lib/services/timetable-entries";
import {
  listRecentActivitiesByCategories,
  RECENT_ACTIVITY_CATEGORY,
  type RecentActivityRecord,
} from "@/lib/services/recent-activity";
import { addCalendarDays, localMidnightUTC, toLocalDateStr } from "@/lib/core/date-utils";
import { getAnnouncementsPage } from "@/lib/services/announcements";
import { getPaginatedInvitesForUser } from "@/lib/services/invites";
import { cn } from "@/lib/core/utils";

// ─── helpers ─────────────────────────────────────────────────────────────────

function minTo12h(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h < 12 ? "am" : "pm";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${ampm}`;
}

function formatMinutesUntil(diffMin: number) {
  const clamped = Math.max(0, diffMin);
  if (clamped < 60) return `${clamped} min`;
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function taskDisplayStatus(status: string, overdue: boolean) {
  switch (status) {
    case "DONE":
      return { label: "Done", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
    case "SKIPPED":
      return { label: "Skipped", tone: "bg-muted text-muted-foreground" };
    case "IN_PROGRESS":
      return { label: "In progress", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" };
    default:
      return overdue
        ? { label: "Overdue", tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300" }
        : { label: "To do", tone: "bg-muted text-muted-foreground" };
  }
}

type RecentWorkItem = {
  id: string;
  name: string;
  updatedAt: Date;
  category: string;
  href: string;
};

type QuickAction = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type DashboardNotice = {
  title: string;
  detail: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
};

function localTimeMin(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function formatLocalDateLabel(dateStr: string, tz: string, todayStr: string) {
  if (dateStr === todayStr) return "Today";
  if (dateStr === addCalendarDays(todayStr, 1)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(localMidnightUTC(dateStr, tz)));
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function isWithinLastDay(date: Date) {
  return Date.now() - date.getTime() < 86_400_000;
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
      parentId: true,
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
  if (!userId) notFound();

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  const currentMembership = await getOrgMembership(orgId, userId);
  const [canManageMembers, canManageTasks, canManageTimetable, canManageSettings] =
    currentMembership
      ? await Promise.all([
          memberHasPermission(currentMembership.id, orgId, PermissionAction.MANAGE_MEMBERS),
          memberHasPermission(currentMembership.id, orgId, PermissionAction.MANAGE_TASKS),
          memberHasPermission(currentMembership.id, orgId, PermissionAction.MANAGE_TIMETABLE),
          memberHasPermission(currentMembership.id, orgId, PermissionAction.MANAGE_SETTINGS),
        ])
      : [false, false, false, false];

  const dashboardMode =
    org.parentId == null && org.ownerId === userId
      ? "franchisor"
      : org.parentId != null && org.ownerId === userId
        ? "franchisee"
        : canManageMembers || canManageTasks || canManageTimetable || canManageSettings
          ? "manager"
          : "worker";

  const roleBadge = {
    worker: "Worker",
    manager: "Manager",
    franchisee: "Franchisee",
    franchisor: "Franchisor",
  }[dashboardMode];

  const todayStr = toLocalDateStr(new Date(), org.timezone);
  const currentTimeMin = localTimeMin(new Date(), org.timezone);
  const viewerId: string = userId ?? org.ownerId ?? orgId;
  const [scheduleInstances, recentActivity, fallbackSets, announcementPage, invitePage] =
    await Promise.all([
      getRangeTimetableInstances(orgId, org.timezone, todayStr, 7),
      listRecentActivitiesByCategories(
        orgId,
        [RECENT_ACTIVITY_CATEGORY.TOOLS, RECENT_ACTIVITY_CATEGORY.ITEM_LISTS],
        6,
      ),
      prisma.conversionSet.findMany({
        where: { orgId },
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: { id: true, name: true, updatedAt: true },
      }),
      getAnnouncementsPage(orgId, { page: 1, pageSize: 4, order: "newest" }),
      getPaginatedInvitesForUser(viewerId, 1, 50),
    ]);

  const todayInstances = scheduleInstances.filter((item) => item.date === todayStr);
  const upcomingInstances = scheduleInstances.filter(
    (item) => item.date > todayStr || (item.date === todayStr && item.startTimeMin > currentTimeMin),
  );

  const typedRecentActivity: RecentActivityRecord[] = recentActivity;
  const recentSets: RecentWorkItem[] =
    typedRecentActivity.length > 0
      ? typedRecentActivity.map((item: RecentActivityRecord): RecentWorkItem => ({
          id: item.entityKey,
          name: item.entityName ?? item.entityKey,
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

  const pendingInvites = invitePage.items.filter((invite) => invite.status === "PENDING");

  const isActiveNow = (item: (typeof todayInstances)[number]) =>
    item.status !== "DONE" &&
    item.status !== "SKIPPED" &&
    item.startTimeMin <= currentTimeMin &&
    currentTimeMin < item.startTimeMin + item.task.durationMin;
  const isOverdue = (item: (typeof todayInstances)[number]) =>
    item.status === "TODO" && item.startTimeMin < currentTimeMin;

  const activeShifts = todayInstances.filter(isActiveNow);
  const overdueToday = todayInstances.filter(isOverdue);
  const doneToday = todayInstances.filter((item) => item.status === "DONE").length;
  const outstandingToday = todayInstances.filter(
    (item) => item.status === "TODO" || item.status === "IN_PROGRESS",
  );

  const openNow =
    org.openTimeMin != null && org.closeTimeMin != null
      ? currentTimeMin >= org.openTimeMin && currentTimeMin < org.closeTimeMin
      : null;
  const operatingLabel =
    org.openTimeMin != null && org.closeTimeMin != null
      ? openNow
        ? `Open until ${minTo12h(org.closeTimeMin)}`
        : currentTimeMin < org.openTimeMin
          ? `Opens at ${minTo12h(org.openTimeMin)}`
          : `Closed after ${minTo12h(org.closeTimeMin)}`
      : "Trading hours not set";

  // Personal shift context — relevant to every role, but the primary signal for a worker.
  const myTodayInstances = currentMembership
    ? todayInstances.filter((item) => item.assignees.some((assignee) => assignee.membership.id === currentMembership.id))
    : [];
  const myUpcomingInstances = currentMembership
    ? upcomingInstances.filter((item) => item.assignees.some((assignee) => assignee.membership.id === currentMembership.id))
    : [];
  const myOutstandingToday = myTodayInstances.filter(
    (item) => item.status === "TODO" || item.status === "IN_PROGRESS",
  );
  const amWorkingNow = myTodayInstances.some(isActiveNow);
  const myNextToday = myOutstandingToday.slice().sort((a, b) => a.startTimeMin - b.startTimeMin)[0] ?? null;
  const myNextShift =
    myUpcomingInstances
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTimeMin - b.startTimeMin)[0] ?? null;

  const rosteredTodayCount = new Set(
    todayInstances.flatMap((item) => item.assignees.map((assignee) => assignee.membership.id)),
  ).size;
  const workingNowCount = new Set(
    activeShifts.flatMap((item) => item.assignees.map((assignee) => assignee.membership.id)),
  ).size;

  const hourOfDay = Math.floor(currentTimeMin / 60);
  const greeting = hourOfDay < 12 ? "Good morning" : hourOfDay < 17 ? "Good afternoon" : "Good evening";
  const displayName = currentUser?.name?.split(" ")[0] ?? "there";
  const isOwner = org.ownerId === userId;

  let personalStatusLine: string;
  if (dashboardMode === "worker") {
    if (amWorkingNow) {
      const names = myTodayInstances.filter(isActiveNow).map((item) => item.task.title).slice(0, 2).join(", ");
      personalStatusLine = `You're working now — ${names}`;
    } else if (myNextToday) {
      const diff = myNextToday.startTimeMin - currentTimeMin;
      personalStatusLine =
        diff > 0
          ? `Rostered today · ${myNextToday.task.title} starts in ${formatMinutesUntil(diff)}`
          : `Rostered today · ${myNextToday.task.title} is due now`;
    } else if (myTodayInstances.length > 0) {
      personalStatusLine = myTodayInstances.some((item) => item.status === "SKIPPED")
        ? "Rostered today · no remaining assigned work"
        : "Rostered today · all of your assigned work is complete";
    } else if (myNextShift) {
      personalStatusLine = `Not rostered today · next shift ${formatLocalDateLabel(myNextShift.date, org.timezone, todayStr)} at ${minTo12h(myNextShift.startTimeMin)}`;
    } else {
      personalStatusLine = "Not rostered today";
    }
  } else {
    personalStatusLine = `${workingNowCount} of ${rosteredTodayCount} rostered staff working now · ${doneToday} of ${todayInstances.length} tasks done today`;
  }

  // ─── Need attention — only actionable signals, nothing decorative ─────────
  const attentionItems: DashboardNotice[] = [];
  if (overdueToday.length > 0) {
    attentionItems.push({
      title: `${overdueToday.length} overdue ${overdueToday.length === 1 ? "task" : "tasks"}`,
      detail: overdueToday.slice(0, 2).map((item) => item.task.title).join(", "),
      href: `/orgs/${orgId}/timetable`,
      icon: AlertTriangle,
      tone: "bg-amber-500/10 text-amber-700 ring-amber-500/15 dark:text-amber-300",
    });
  }
  if (dashboardMode !== "worker" && openNow && activeShifts.length === 0 && todayInstances.length > 0) {
    attentionItems.push({
      title: "No one is currently working",
      detail: "The location is open but no rostered shift is active right now.",
      href: `/orgs/${orgId}/timetable`,
      icon: ShieldAlert,
      tone: "bg-rose-500/10 text-rose-700 ring-rose-500/15 dark:text-rose-300",
    });
  }
  if (dashboardMode !== "worker" && pendingInvites.length > 0) {
    attentionItems.push({
      title: `${pendingInvites.length} pending invite${pendingInvites.length === 1 ? "" : "s"}`,
      detail: "People are waiting to join the organisation.",
      href: `/orgs/${orgId}/memberships`,
      icon: Bell,
      tone: "bg-cyan-500/10 text-cyan-700 ring-cyan-500/15 dark:text-cyan-300",
    });
  }

  // ─── Today's priority list — the single ranked list of what to do first ──
  const priorityItems = (dashboardMode === "worker" ? myOutstandingToday : outstandingToday)
    .slice()
    .sort((a, b) => {
      const aOverdue = isOverdue(a) ? 0 : 1;
      const bOverdue = isOverdue(b) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return a.startTimeMin - b.startTimeMin;
    })
    .slice(0, 6);

  // ─── Operations brief — a three-line, data-driven summary of the day ─────
  const changedParts: string[] = [];
  if (doneToday > 0) changedParts.push(`${doneToday} ${doneToday === 1 ? "task" : "tasks"} completed`);
  if (activeShifts.length > 0) changedParts.push(`${activeShifts.length} ${activeShifts.length === 1 ? "shift" : "shifts"} in progress`);
  const freshAnnouncements = announcementPage.announcements.filter((announcement) => isWithinLastDay(announcement.createdAt));
  if (freshAnnouncements.length > 0) {
    changedParts.push(`${freshAnnouncements.length} new ${freshAnnouncements.length === 1 ? "announcement" : "announcements"}`);
  }
  const changedLine = changedParts.length > 0 ? changedParts.join(" · ") : "No changes right now.";

  const attentionLine =
    attentionItems.length > 0 ? attentionItems.map((item) => item.title).join(" · ") : "Nothing needs your attention right now.";

  const firstPriority = priorityItems[0] ?? null;
  const doFirstLine = firstPriority
    ? `Start with ${firstPriority.task.title} — due ${minTo12h(firstPriority.startTimeMin)}.`
    : attentionItems.length > 0
      ? `Review: ${attentionItems[0].title}.`
      : dashboardMode === "worker" && myTodayInstances.length === 0
        ? "Nothing scheduled for you today."
        : "Nothing urgent — steady state.";

  // ─── Quick access — a handful of role-curated shortcuts, nothing more ────
  const quickActionsByMode: Record<string, QuickAction[]> = {
    worker: [
      { label: "My shift", href: `/orgs/${orgId}/timetable`, icon: CalendarDays },
      { label: "My tasks", href: `/orgs/${orgId}/tasks`, icon: ListTodo },
      { label: "Procedures", href: "/doc", icon: BookOpen },
    ],
    manager: [
      { label: "Roster", href: `/orgs/${orgId}/tools/roster`, icon: Users },
      { label: "Timetable", href: `/orgs/${orgId}/timetable`, icon: CalendarDays },
      { label: "Tasks", href: `/orgs/${orgId}/tasks`, icon: ClipboardList },
      { label: "Announcement", href: `/orgs/${orgId}/announcements`, icon: Megaphone },
    ],
    franchisee: [
      { label: "Timetable", href: `/orgs/${orgId}/timetable`, icon: CalendarDays },
      { label: "Members", href: `/orgs/${orgId}/memberships`, icon: Users },
      { label: "Announcements", href: `/orgs/${orgId}/announcements`, icon: Megaphone },
      { label: "Settings", href: `/orgs/${orgId}/settings/organization`, icon: Settings },
    ],
    franchisor: [
      { label: "Announcements", href: `/orgs/${orgId}/announcements`, icon: Megaphone },
      { label: "Members", href: `/orgs/${orgId}/memberships`, icon: Users },
      { label: "Timetable", href: `/orgs/${orgId}/timetable`, icon: CalendarDays },
      { label: "Settings", href: `/orgs/${orgId}/settings/organization`, icon: Settings },
    ],
  };
  const quickActions = quickActionsByMode[dashboardMode];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      <section className="rounded-2xl border border-border/60 bg-card px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-center justify-center gap-2 text-center sm:justify-start sm:text-left">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: orgColor(org.name) }} />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{roleBadge}</span>
          {isOwner && dashboardMode !== "franchisor" && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Owner
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/70">
            {operatingLabel}
          </span>
        </div>

        <h1 className="mt-3 text-center text-2xl font-semibold tracking-tight sm:text-left sm:text-[1.75rem]" data-org-name={org.name}>
          {greeting}, {displayName}
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground sm:text-left">{org.name}</p>

        <div className="mt-3 flex items-start gap-2 text-sm text-foreground sm:items-center">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-center sm:text-left">{personalStatusLine}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground sm:justify-start">
          {org.address && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
              <MapPin className="h-3.5 w-3.5" />
              <span className="max-w-[16rem] truncate">{org.address}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
            <Globe className="h-3.5 w-3.5" />
            {org.timezone.replace(/_/g, " ")}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Today&apos;s brief</p>
        <dl className="mt-2 space-y-2 text-sm leading-6 text-foreground">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="shrink-0 font-medium text-muted-foreground">Changed</dt>
            <dd className="min-w-0">{changedLine}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="shrink-0 font-medium text-muted-foreground">Attention</dt>
            <dd className="min-w-0">{attentionLine}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="shrink-0 font-medium text-muted-foreground">Do first</dt>
            <dd className="min-w-0">{doFirstLine}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Quick access</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/70 bg-background px-4 py-3 text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground text-center sm:text-left">
              {dashboardMode === "worker" ? "My priority" : "Today's operation"}
            </h2>
          </div>
          <p className="mt-1 text-center text-sm text-muted-foreground sm:text-left">
            {dashboardMode === "worker"
              ? "What you need to do next, most urgent first."
              : "What's outstanding across the floor right now, most urgent first."}
          </p>

          <div className="mt-4 flex flex-col gap-2">
            {priorityItems.length > 0 ? (
              priorityItems.map((item) => {
                const overdue = isOverdue(item);
                const display = taskDisplayStatus(item.status, overdue);
                const assignees = item.assignees
                  .map((assignee) => assignee.membership.user?.name ?? assignee.membership.botName ?? "Unassigned")
                  .filter(Boolean)
                  .slice(0, 2);
                return (
                  <Link
                    key={item.id}
                    href={`/orgs/${orgId}/timetable`}
                    className="group flex flex-col gap-2 rounded-xl border border-border/60 bg-background px-3 py-3 transition-colors hover:border-primary/30 sm:flex-row sm:items-center sm:gap-3 sm:py-2.5"
                  >
                    <span className="inline-flex shrink-0 items-center gap-1.5 self-start text-xs text-muted-foreground sm:self-auto">
                      <Clock className="h-3.5 w-3.5" />
                      {minTo12h(item.startTimeMin)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{item.task.title}</span>
                      {dashboardMode !== "worker" && assignees.length > 0 && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {assignees.join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", display.tone)}>
                        {display.label}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </Link>
                );
              })
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
                {dashboardMode === "worker"
                  ? myTodayInstances.length === 0
                    ? "You're not rostered today."
                    : "All of your assigned work for today is complete."
                  : todayInstances.length === 0
                    ? "Nothing scheduled today."
                    : "Everything scheduled today is complete."}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-center text-muted-foreground sm:text-left">Need attention</h2>
          </div>
          <p className="mt-1 text-center text-sm text-muted-foreground sm:text-left">Only issues that need a decision, nothing else.</p>

          <div className="mt-4 flex flex-col gap-2">
            {attentionItems.length > 0 ? (
              attentionItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="group flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3 transition-colors hover:border-primary/30"
                  >
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1", item.tone)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                );
              })
            ) : (
              <p className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 shrink-0" />
                Everything requiring your attention is up to date.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-left">Training &amp; standards</h2>
          </div>
          <p className="mt-1 text-center text-sm text-muted-foreground sm:text-left">Guides and procedures to keep the location consistent.</p>
          <Link
            href="/doc"
            className="group mt-4 flex items-center gap-3 rounded-xl border border-border/60 bg-background p-3 transition-colors hover:border-primary/30"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border/70">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Open docs</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Guides, procedures, and reference material.</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-left">Announcements &amp; updates</h2>
          </div>
          <p className="mt-1 text-center text-sm text-muted-foreground sm:text-left">Global notices are shared across locations.</p>
          <div className="mt-4 flex flex-col gap-2">
            {announcementPage.announcements.length > 0 ? (
              announcementPage.announcements.map((announcement) => (
                <Link
                  key={announcement.id}
                  href={`/orgs/${orgId}/announcements`}
                  className="group flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3 transition-colors hover:border-primary/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {announcement.scope === "GLOBAL" && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
                          Global
                        </span>
                      )}
                      <p className="truncate text-sm font-medium text-foreground">{announcement.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{truncate(announcement.description, 100)}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatRelativeTime(announcement.createdAt)}</p>
                  </div>
                  <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                No announcements posted yet.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-left">Recent relevant activity</h2>
        </div>
        <p className="mt-1 text-center text-sm text-muted-foreground sm:text-left">
          Only meaningful updates that help this role understand what changed.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {recentSets.length > 0 ? (
            recentSets.slice(0, 5).map((item) => {
              const Icon = item.category === RECENT_ACTIVITY_CATEGORY.ITEM_LISTS ? LayoutList : ArrowLeftRight;
              return (
                <Link
                  key={`${item.category}:${item.id}`}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl border border-border/60 bg-background p-3 transition-colors hover:border-primary/30"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(item.updatedAt)}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              );
            })
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
              No recent activity yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default Page;

