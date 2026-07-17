"use client";

import { useMemo, type RefObject } from "react";
import Image from "next/image";
import { Users } from "lucide-react";
import { SearchInput } from "@/components/ui/controls/search-input";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/core/utils";
import { useSupportsHover } from "@/hooks/use-hover-capability";
import { RegisterPageToolbar } from "@/components/layout/contexts/toolbar-context";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
import { MemberActions } from "./member-actions";
import { MemberViewPanel } from "./member-view-panel";

type Role = { id: string; name: string; color: string };

type Member = {
  id: string;
  userId: string | null;
  botName: string | null;
  status: "ACTIVE" | "RESTRICTED";
  workingDays: string[];
  joinedAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  memberRoles: { role: { id: string; name: string; color: string } }[];
};

function Avatar({
  name,
  image,
  size = "md",
}: {
  name: string | null;
  image: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const initials = (name ?? "?")
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-16 w-16 text-xl",
  };

  const imgPx = size === "lg" ? 64 : size === "md" ? 40 : 32;

  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? "Member"}
        width={imgPx}
        height={imgPx}
        className={cn("rounded-full object-cover shrink-0", sizeClasses[size])}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center shrink-0",
        sizeClasses[size],
      )}
    >
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: "ACTIVE" | "RESTRICTED" }) {
  if (status === "ACTIVE") return null;
  return (
    <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-destructive/20 ring-inset">
      Restricted
    </span>
  );
}

function RolesBadge({
  roles,
  align = "center",
}: {
  roles: { id: string; name: string; color: string }[];
  align?: "center" | "start";
}) {
  const justifyClass = align === "start" ? "justify-start" : "justify-center";

  if (roles.length === 0) {
    return <span className="text-xs text-muted-foreground">No role</span>;
  }

  if (roles.length > 2) {
    return (
      <div className={cn("flex flex-wrap gap-1", justifyClass)}>
        {roles.map((role) => (
          <span
            key={role.id}
            title={role.name}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            style={{ backgroundColor: `${role.color}22`, color: role.color }}
          >
            {role.name[0].toUpperCase()}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1", justifyClass)}>
      {roles.map((role) => (
        <span
          key={role.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `${role.color}22`, color: role.color }}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: role.color }} />
          {role.name}
        </span>
      ))}
    </div>
  );
}

export function MembersView({
  members,
  orgId,
  canManage,
  allRoles,
  view,
  search,
  onSearchChange,
  totalCount,
  isLoadingInitial,
  isLoadingMore,
  hasMore,
  sentinelRef,
  onMemberSaved,
  onMemberDeleted,
}: {
  members: Member[];
  orgId: string;
  canManage: boolean;
  allRoles: Role[];
  view: "list" | "card";
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  onMemberSaved: () => void;
  onMemberDeleted: () => void;
}) {
  const { open } = useActionSidebar();
  const supportsHover = useSupportsHover();

  const displayCount = useMemo(() => {
    if (totalCount === 0) return "0 members";
    if (members.length >= totalCount) {
      return `${totalCount} member${totalCount !== 1 ? "s" : ""}`;
    }
    return `Loaded ${members.length} of ${totalCount}`;
  }, [members.length, totalCount]);

  function handleView(member: Member) {
    const displayName = member.user?.name ?? member.botName ?? "Member";
    const roles = member.memberRoles.map(({ role }) => role);

    open(
      displayName,
      <MemberViewPanel
        orgId={orgId}
        membershipId={member.id}
        name={displayName}
        email={member.user?.email ?? null}
        image={member.user?.image ?? null}
        isBot={member.userId === null}
        workingDays={member.workingDays}
        roles={roles}
        status={member.status}
        joinedAt={member.joinedAt}
        canManage={canManage}
        allRoles={allRoles}
        initialRoleIds={member.memberRoles.map(({ role }) => role.id)}
        onMemberSaved={onMemberSaved}
      />,
    );
  }

  return (
    <>
      <RegisterPageToolbar>
        <SearchInput
          placeholder="Search members…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7"
          containerClassName="flex-1 min-w-50"
          aria-label="Search members by name"
        />
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{displayCount}</span>
      </RegisterPageToolbar>

      <div className="flex flex-col">
        {isLoadingInitial ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <Users className="h-6 w-6 animate-pulse text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Loading members…</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Please wait while we fetch the first batch.
              </p>
            </div>
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{totalCount === 0 ? "No members yet" : "No members found"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {totalCount === 0
                  ? "Invite someone to get started."
                  : "Try adjusting your search or role filter."}
              </p>
            </div>
          </div>
        ) : view === "card" ? (
          <CardGrid
            members={members}
            orgId={orgId}
            canManage={canManage}
            allRoles={allRoles}
            supportsHover={supportsHover}
            onView={handleView}
            onMemberDeleted={onMemberDeleted}
          />
        ) : (
          <MemberList
            members={members}
            orgId={orgId}
            canManage={canManage}
            allRoles={allRoles}
            supportsHover={supportsHover}
            onView={handleView}
            onMemberDeleted={onMemberDeleted}
          />
        )}

        {hasMore && (
          <div
            ref={sentinelRef}
            className="mt-4 flex items-center justify-center rounded-xl border bg-card px-3 py-3 text-sm text-muted-foreground"
          >
            {isLoadingMore ? (
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 animate-pulse" />
                Loading more members…
              </span>
            ) : (
              <span>Scroll to load more</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function CardGrid({
  members,
  orgId,
  canManage,
  allRoles,
  supportsHover,
  onView,
  onMemberDeleted,
}: {
  members: Member[];
  orgId: string;
  canManage: boolean;
  allRoles: Role[];
  supportsHover: boolean;
  onView: (member: Member) => void;
  onMemberDeleted: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {members.map((member) => {
        const roles = member.memberRoles.map(({ role }) => ({
          id: role.id,
          name: role.name,
          color: role.color,
        }));

        return (
          <div
            key={member.id}
            className="group relative cursor-pointer"
            onClick={() => onView(member)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                if (e.key === " " || e.key === "Spacebar") e.preventDefault();
                onView(member);
              }
            }}
          >
            <Card className="h-full cursor-pointer overflow-hidden text-center transition-all group-hover:border-primary/20 group-hover:shadow-md">
              <div className="flex justify-center pt-5">
                <Avatar name={member.user?.name ?? member.botName} image={member.user?.image ?? null} size="lg" />
              </div>
              <CardContent className="flex flex-col items-center gap-1.5 pb-4 pt-3">
                <CardTitle className="flex w-full flex-wrap items-center justify-center gap-1.5 text-sm leading-tight">
                  <span className="truncate">{member.user?.name ?? member.botName ?? "Unnamed"}</span>
                  {member.userId === null && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                      Bot
                    </span>
                  )}
                </CardTitle>
                <RolesBadge roles={roles} />
                <StatusBadge status={member.status} />
              </CardContent>
            </Card>
            {canManage && (
              <div
                className={`absolute right-1 top-1 transition-opacity ${supportsHover ? "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100" : "opacity-100"}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MemberActions
                  orgId={orgId}
                  membershipId={member.id}
                  memberName={member.user?.name ?? member.botName}
                  email={member.user?.email ?? undefined}
                  allRoles={allRoles}
                  isCurrentlyBot={member.userId === null}
                  initialRoleIds={member.memberRoles.map(({ role }) => role.id)}
                  initialWorkingDays={member.workingDays}
                  image={member.user?.image ?? null}
                  onDeleted={onMemberDeleted}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MemberList({
  members,
  orgId,
  canManage,
  allRoles,
  supportsHover,
  onView,
  onMemberDeleted,
}: {
  members: Member[];
  orgId: string;
  canManage: boolean;
  allRoles: Role[];
  supportsHover: boolean;
  onView: (member: Member) => void;
  onMemberDeleted: () => void;
}) {
  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
      {members.map((member) => {
        const roles = member.memberRoles.map(({ role }) => ({
          id: role.id,
          name: role.name,
          color: role.color,
        }));

        return (
          <li key={member.id} className="group flex items-center transition-colors hover:bg-primary/5">
            <button
              onClick={() => onView(member)}
              className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
            >
              <Avatar name={member.user?.name ?? member.botName} image={member.user?.image ?? null} size="md" />
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium">{member.user?.name ?? member.botName ?? "Unnamed"}</p>
                  {member.userId === null && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                      Bot
                    </span>
                  )}
                </div>
                <RolesBadge roles={roles} align="start" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge status={member.status} />
                <span className="hidden text-xs text-muted-foreground sm:block">
                  Joined {member.joinedAt.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                </span>
              </div>
            </button>
            {canManage && (
              <div
                className={`shrink-0 pr-3 transition-opacity ${supportsHover ? "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100" : "opacity-100"}`}
              >
                <MemberActions
                  orgId={orgId}
                  membershipId={member.id}
                  memberName={member.user?.name ?? member.botName}
                  email={member.user?.email ?? undefined}
                  allRoles={allRoles}
                  isCurrentlyBot={member.userId === null}
                  initialRoleIds={member.memberRoles.map(({ role }) => role.id)}
                  initialWorkingDays={member.workingDays}
                  image={member.user?.image ?? null}
                  onDeleted={onMemberDeleted}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}