import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { requireUserPage } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getPublicUrl } from "@/lib/supabase-storage";
import { Building2, Plus, Network, Users, Globe, ChevronRight } from "lucide-react";
import { orgColor } from "@/lib/org-color";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrgNotFoundToast } from "./org-not-found-toast";
import { RecentOrgBanner } from "./recent-org-banner";
import { HubInviteSection } from "./hub-invite-section";
import { getPaginatedInvitesForUser } from "@/lib/services/invites";

// ─── Org card ─────────────────────────────────────────────────────────────────

function OrgInitials({ name, color }: { name: string; color: string }) {
  const words = name.trim().split(/\s+/);
  const initials =
    words.length >= 2 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase shadow-sm ring-1 ring-white/70"
      style={{ backgroundColor: color + "25", color }}
    >
      {initials}
    </div>
  );
}

function toTourSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type OrgEntry = {
  id: string;
  name: string;
  image: string | null;
  isOwner: boolean;
  memberCount: number;
  timezone: string;
  isParent: boolean;
};

function OrgCard({ org }: { org: OrgEntry }) {
  const color = orgColor(org.name);
  const tourSlug = toTourSlug(org.name);
  return (
    <Link
      href={`/orgs/${org.id}`}
      data-tour-target={`org-card-${tourSlug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-150",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg",
      )}
    >
      {/* Color accent bar */}
      <div className="h-1.5" style={{ backgroundColor: color }} />

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          {org.image ? (
            <Image
              src={org.image}
              alt={org.name}
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-border/70"
            />
          ) : (
            <OrgInitials name={org.name} color={color} />
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {org.name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {org.isOwner && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Owner
                </span>
              )}
              {org.isParent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <Network className="h-3 w-3" />
                  Franchisor
                </span>
              )}
              {!org.isOwner && !org.isParent && (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Member
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1">
            <Users className="h-3.5 w-3.5" />
            {org.memberCount} {org.memberCount === 1 ? "member" : "members"}
          </span>
          <span className="flex items-center gap-1.5 truncate">
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{org.timezone.replace(/_/g, " ")}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── New org tile ─────────────────────────────────────────────────────────────

function NewOrgTile() {
  return (
    <Link
      href="/orgs/new"
      className={cn(
        "group flex min-h-30 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 transition-all duration-150",
        "border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary",
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
        <Plus className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium">New Organization</p>
    </Link>
  );
}

// ─── Empty state cards ────────────────────────────────────────────────────────

function EmptyActionCard({
  href,
  icon: Icon,
  title,
  description,
  primary,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col items-center text-center gap-4 rounded-xl border-2 border-dashed p-10 transition-all duration-150",
        primary
          ? "border-primary/30 hover:border-primary hover:bg-primary/5"
          : "border-border hover:border-muted-foreground/40 hover:bg-muted/40",
      )}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center",
          primary
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[20ch] mx-auto leading-relaxed">
          {description}
        </p>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<{ orgNotFound?: string }>;
}) {
  const { orgNotFound } = await searchParams;
  const { userId } = await requireUserPage();

  const [memberships, invitePage] = await Promise.all([
    prisma.membership.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            _count: {
              select: { memberships: { where: { userId: { not: null } } } },
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    getPaginatedInvitesForUser(userId, 1, 50),
  ]);

  const pendingInvites = invitePage.items.filter((i) => i.status === "PENDING");

  const orgs: OrgEntry[] = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    image: m.organization.image ? getPublicUrl(m.organization.image) : null,
    isOwner: m.organization.ownerId === userId,
    memberCount: m.organization._count.memberships,
    timezone: m.organization.timezone,
    isParent: !m.organization.parentId && m.organization.ownerId === userId,
  }));

  return (
    <div className="max-w-4xl mx-auto w-full">
      {orgNotFound && (
        <Suspense>
          <OrgNotFoundToast />
        </Suspense>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">
              Organizations
            </h1>
            {orgs.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-medium">
                {orgs.length}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {orgs.length === 0
              ? "You're not part of any organization yet."
              : `You're a member of ${orgs.length} organization${orgs.length !== 1 ? "s" : ""}.`}
          </p>
        </div>
        {orgs.length > 0 && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link href="/orgs/join">
                <Network className="h-4 w-4" />
                Join Franchise
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/orgs/new">
                <Plus className="h-4 w-4" />
                New Org
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Pending invitations */}
      <HubInviteSection invites={pendingInvites} />

      {/* Recent org banner (client — reads localStorage) */}
      {orgs.length > 0 && <RecentOrgBanner orgs={orgs} />}

      {/* Org grid */}
      {orgs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map((org) => (
            <OrgCard key={org.id} org={org} />
          ))}
          <NewOrgTile />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <EmptyActionCard
            href="/orgs/new"
            icon={Building2}
            title="Create an Organization"
            description="Set up your own org, add members and manage timetables."
            primary
          />
          <EmptyActionCard
            href="/orgs/join"
            icon={Network}
            title="Join a Franchise"
            description="Have an invite token? Join an existing franchise network."
          />
        </div>
      )}
    </div>
  );
}
