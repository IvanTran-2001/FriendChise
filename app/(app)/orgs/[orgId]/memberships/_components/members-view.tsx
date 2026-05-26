/**
 * MembersView — client component for the org members list page.
 *
 * Renders a toolbar (search) and the member roster in one of two layouts chosen
 * via the page sidebar:
 *
 *   - List view  (`MemberList`)  — compact rows, ideal for many members.
 *   - Card view  (`CardGrid`)    — photo-forward grid, one card per member.
 *
 * All filtering is done client-side on the already-fetched `members` array so
 * there are no round-trips when the user types or changes the role filter.
 *
 * Sub-components:
 *   - `Avatar`      — shows the member's profile photo or a two-letter
 *                     initial fallback at three sizes (sm / md / lg).
 *   - `StatusBadge` — shown only when a member's status is RESTRICTED.
 *   - `RolesBadge`  — pill list of role names; `align` prop controls
 *                     left-align (list view) vs center-align (card view).
 *   - `CardGrid`    — responsive grid of shadcn Cards (card view).
 *   - `MemberList`  — bordered list of rows (list view).
 *
 * Clicking any member row / card navigates to `/orgs/[orgId]/memberships/[userId]`.
 */
"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Users } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Toolbar } from "@/components/layout/toolbar";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { MemberActions } from "./member-actions";
import { MemberViewPanel } from "./action-sidebar/member-view-panel";

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
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-16 w-16 text-xl",
  };

  // next/image requires explicit numeric dimensions — must match sizeClasses above.
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
  if (roles.length === 0)
    return <span className="text-xs text-muted-foreground">No role</span>;
  if (roles.length > 2) {
    return (
      <div className={cn("flex flex-wrap gap-1", justifyClass)}>
        {roles.map((r) => (
          <span
            key={r.id}
            title={r.name}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0"
            style={{ backgroundColor: r.color + "22", color: r.color }}
          >
            {r.name[0].toUpperCase()}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-wrap gap-1", justifyClass)}>
      {roles.map((r) => (
        <span
          key={r.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: r.color + "22", color: r.color }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: r.color }}
          />
          {r.name}
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
  roleId,
  view,
}: {
  members: Member[];
  orgId: string;
  canManage: boolean;
  allRoles: Role[];
  roleId: string | null;
  view: "list" | "card";
}) {
  const [search, setSearch] = useState("");
  const { open } = useActionSidebar();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return members.filter((m) => {
      if (q && !(m.user?.name ?? m.botName ?? "").toLowerCase().includes(q))
        return false;
      if (roleId && !m.memberRoles.some(({ role }) => role.id === roleId))
        return false;
      return true;
    });
  }, [members, search, roleId]);

  function handleView(m: Member) {
    const displayName = m.user?.name ?? m.botName ?? "Member";
    const roles = m.memberRoles.map(({ role }) => role);
    open(
      displayName,
      <MemberViewPanel
        orgId={orgId}
        membershipId={m.id}
        name={displayName}
        email={m.user?.email ?? null}
        image={m.user?.image ?? null}
        isBot={m.userId === null}
        workingDays={m.workingDays}
        roles={roles}
        status={m.status}
        joinedAt={m.joinedAt}
        canManage={canManage}
        allRoles={allRoles}
        initialRoleIds={m.memberRoles.map(({ role }) => role.id)}
      />,
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <Toolbar>
        <SearchInput
          placeholder="Search members…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7"
          containerClassName="flex-1 min-w-50"
          aria-label="Search members by name"
        />
        <span className="ml-auto text-xs text-muted-foreground shrink-0">
          {filtered.length === members.length
            ? `${members.length} member${members.length !== 1 ? "s" : ""}`
            : `${filtered.length} of ${members.length}`}
        </span>
      </Toolbar>

      <div className="flex-1 min-h-0 overflow-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="rounded-full bg-muted p-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {members.length === 0 ? "No members yet" : "No members found"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {members.length === 0
                  ? "Invite someone to get started."
                  : "Try adjusting your search or role filter."}
              </p>
            </div>
          </div>
        ) : view === "card" ? (
          <CardGrid
            members={filtered}
            orgId={orgId}
            canManage={canManage}
            allRoles={allRoles}
            onView={handleView}
          />
        ) : (
          <MemberList
            members={filtered}
            orgId={orgId}
            canManage={canManage}
            allRoles={allRoles}
            onView={handleView}
          />
        )}
      </div>
    </div>
  );
}

function CardGrid({
  members,
  orgId,
  canManage,
  allRoles,
  onView,
}: {
  members: Member[];
  orgId: string;
  canManage: boolean;
  allRoles: Role[];
  onView: (m: Member) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {members.map((m) => {
        const roles = m.memberRoles.map(({ role }) => ({
          id: role.id,
          name: role.name,
          color: role.color,
        }));
        return (
          <div
            key={m.id}
            className="group relative cursor-pointer"
            onClick={() => onView(m)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                if (e.key === ' ' || e.key === 'Spacebar') e.preventDefault();
                onView(m);
              }
            }}
          >
            <Card className="h-full items-center text-center transition-all group-hover:shadow-md group-hover:border-primary/20 cursor-pointer overflow-hidden">
              <div className="pt-5 flex justify-center">
                <Avatar
                  name={m.user?.name ?? m.botName}
                  image={m.user?.image ?? null}
                  size="lg"
                />
              </div>
              <CardContent className="flex flex-col items-center gap-1.5 pb-4 pt-3">
                <CardTitle className="text-sm leading-tight w-full flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="truncate">
                    {m.user?.name ?? m.botName ?? "Unnamed"}
                  </span>
                  {m.userId === null && (
                    <span className="inline-flex items-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 text-[10px] font-medium shrink-0">
                      Bot
                    </span>
                  )}
                </CardTitle>
                <RolesBadge roles={roles} />
                <StatusBadge status={m.status} />
              </CardContent>
            </Card>
            {canManage && (
              <div
                className="absolute top-1 right-1"
                onClick={(e) => e.stopPropagation()}
              >
                <MemberActions
                  orgId={orgId}
                  membershipId={m.id}
                  memberName={m.user?.name ?? m.botName}
                  email={m.user?.email ?? undefined}
                  allRoles={allRoles}
                  isCurrentlyBot={m.userId === null}
                  initialRoleIds={m.memberRoles.map(({ role }) => role.id)}
                  initialWorkingDays={m.workingDays}
                  image={m.user?.image ?? null}
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
  onView,
}: {
  members: Member[];
  orgId: string;
  canManage: boolean;
  allRoles: Role[];
  onView: (m: Member) => void;
}) {
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card overflow-hidden shadow-sm">
      {members.map((m) => {
        const roles = m.memberRoles.map(({ role }) => ({
          id: role.id,
          name: role.name,
          color: role.color,
        }));
        return (
          <li
            key={m.id}
            className="flex items-center hover:bg-primary/5 transition-colors"
          >
            <button
              onClick={() => onView(m)}
              className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0 text-left"
            >
              <Avatar
                name={m.user?.name ?? m.botName}
                image={m.user?.image ?? null}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-sm font-medium truncate">
                    {m.user?.name ?? m.botName ?? "Unnamed"}
                  </p>
                  {m.userId === null && (
                    <span className="inline-flex items-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 text-[10px] font-medium shrink-0">
                      Bot
                    </span>
                  )}
                </div>
                <RolesBadge roles={roles} align="start" />
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <StatusBadge status={m.status} />
                <span className="text-xs text-muted-foreground hidden sm:block">
                  Joined{" "}
                  {m.joinedAt.toLocaleDateString(undefined, {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </button>
            {canManage && (
              <div className="pr-3 shrink-0">
                <MemberActions
                  orgId={orgId}
                  membershipId={m.id}
                  memberName={m.user?.name ?? m.botName}
                  email={m.user?.email ?? undefined}
                  allRoles={allRoles}
                  isCurrentlyBot={m.userId === null}
                  initialRoleIds={m.memberRoles.map(({ role }) => role.id)}
                  initialWorkingDays={m.workingDays}
                  image={m.user?.image ?? null}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
