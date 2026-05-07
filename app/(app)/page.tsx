import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { requireUserPage } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Building2, Plus, Network, Users, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrgNotFoundToast } from "./org-not-found-toast";
import { RecentOrgBanner } from "./recent-org-banner";
import { HubInviteSection } from "./hub-invite-section";
import { getInvitesForUser } from "@/lib/services/invites";

// ─── Org card ─────────────────────────────────────────────────────────────────

function OrgInitials({ name }: { name: string }) {
  const words = name.trim().split(/\s+/);
  const initials =
    words.length >= 2
      ? words[0][0] + words[1][0]
      : name.slice(0, 2);
  return (
    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0 uppercase">
      {initials}
    </div>
  );
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
  return (
    <Link
      href={`/orgs/${org.id}`}
      className={cn(
        "group flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm",
        "hover:border-primary/40 hover:shadow-md transition-all duration-150",
      )}
    >
      <div className="flex items-start gap-3">
        {org.image ? (
          <Image
            src={org.image}
            alt={org.name}
            width={44}
            height={44}
            className="rounded-xl object-cover shrink-0"
          />
        ) : (
          <OrgInitials name={org.name} />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate leading-tight">{org.name}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {org.isOwner && (
              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                Owner
              </span>
            )}
            {org.isParent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">
                <Network className="h-3 w-3" />
                Franchisor
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-3">
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {org.memberCount} {org.memberCount === 1 ? "member" : "members"}
        </span>
        <span className="flex items-center gap-1.5 truncate">
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{org.timezone.replace(/_/g, " ")}</span>
        </span>
      </div>
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
          primary ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
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

  const [memberships, allInvites] = await Promise.all([
    prisma.membership.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          _count: { select: { memberships: { where: { userId: { not: null } } } } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  }),
    getInvitesForUser(userId),
  ]);

  const pendingInvites = allInvites.filter((i) => i.status === "PENDING");

  const orgs: OrgEntry[] = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    image: m.organization.image,
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
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
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
