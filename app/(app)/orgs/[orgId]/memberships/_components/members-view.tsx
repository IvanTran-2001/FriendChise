/**
 * MembersView — client component for the org members list page.
 *
 * Renders a toolbar (search, role filter, view toggle, "+ Add Member" button)
 * and the member roster in one of two layouts chosen by the user:
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
 *   - `RolesBadge`  — comma-separated list of role names, or "No role".
 *   - `CardGrid`    — responsive grid of shadcn Cards (card view).
 *   - `MemberList`  — bordered list of rows (list view).
 *
 * Clicking any member row / card navigates to `/orgs/[orgId]/memberships/[userId]`.
 */
"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, LayoutGrid, List, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MemberActions } from "./member-actions";

type Member = {
  userId: string;
  status: "ACTIVE" | "RESTRICTED";
  user: { id: string; name: string | null; image: string | null };
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

function RolesBadge({ roles }: { roles: { id: string; name: string; color: string }[] }) {
  if (roles.length === 0)
    return <span className="text-xs text-muted-foreground">No role</span>;
  return (
    <div className="flex flex-wrap gap-1 justify-center">
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
}: {
  members: Member[];
  orgId: string;
  canManage: boolean;
}) {
  const [view, setView] = useState<"card" | "list">("card");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  const allRoles = useMemo(() => {
    const seen = new Set<string>();
    const roles: { id: string; name: string }[] = [];
    for (const m of members) {
      for (const { role } of m.memberRoles) {
        if (!seen.has(role.id)) {
          seen.add(role.id);
          roles.push(role);
        }
      }
    }
    return roles.sort((a, b) => a.name.localeCompare(b.name));
  }, [members]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return members.filter((m) => {
      if (q && !(m.user.name ?? "").toLowerCase().includes(q)) return false;
      if (
        roleFilter &&
        !m.memberRoles.some(({ role }) => role.id === roleFilter)
      )
        return false;
      return true;
    });
  }, [members, search, roleFilter]);

  return (
    <>
      {/* Toolbar */}
      <div className="-mx-6 -mt-6 mb-6 border-b bg-card px-6 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative w-52">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search members…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7"
            />
          </div>

          {/* Role filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                {roleFilter
                  ? (allRoles.find((r) => r.id === roleFilter)?.name ?? "Role")
                  : "All roles"}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => setRoleFilter(null)}>
                All roles
              </DropdownMenuItem>
              {allRoles.map((role) => (
                <DropdownMenuItem
                  key={role.id}
                  onSelect={() => setRoleFilter(role.id)}
                >
                  {role.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <Button asChild size="sm">
              <Link href={`/orgs/${orgId}/memberships/new`}>+ Add Member</Link>
            </Button>
          )}

          {/* View toggle — always rightmost */}
          <div className="flex items-center rounded-md border overflow-hidden">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "p-1.5 transition-colors",
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
              aria-label="List view"
              aria-pressed={view === "list"}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("card")}
              className={cn(
                "p-1.5 transition-colors",
                view === "card"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
              aria-label="Card view"
              aria-pressed={view === "card"}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {members.length === 0
            ? "No members yet."
            : "No members match your search."}
        </p>
      ) : view === "card" ? (
        <CardGrid members={filtered} orgId={orgId} canManage={canManage} />
      ) : (
        <MemberList members={filtered} orgId={orgId} canManage={canManage} />
      )}
    </>
  );
}

function CardGrid({
  members,
  orgId,
  canManage,
}: {
  members: Member[];
  orgId: string;
  canManage: boolean;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {members.map((m) => {
        const roles = m.memberRoles.map(({ role }) => ({ id: role.id, name: role.name, color: role.color }));
        return (
          <Link
            key={m.userId}
            href={`/orgs/${orgId}/memberships/${m.userId}`}
            className="group"
          >
            <Card className="items-center text-center transition-all group-hover:shadow-md group-hover:border-primary/20 cursor-pointer">
              <div className="pt-4 flex justify-center">
                <Avatar name={m.user.name} image={m.user.image} size="lg" />
              </div>
              <CardContent className="flex flex-col items-center gap-1.5 pb-4 pt-3">
                <CardTitle className="text-sm leading-tight">
                  {m.user.name ?? "Unnamed user"}
                </CardTitle>
                <RolesBadge roles={roles} />
                <StatusBadge status={m.status} />
                {canManage && (
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <MemberActions
                      orgId={orgId}
                      userId={m.userId}
                      memberName={m.user.name}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function MemberList({
  members,
  orgId,
  canManage,
}: {
  members: Member[];
  orgId: string;
  canManage: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card overflow-hidden shadow-sm">
      {members.map((m) => {
        const roles = m.memberRoles.map(({ role }) => ({ id: role.id, name: role.name, color: role.color }));
        return (
          <li
            key={m.userId}
            className="flex items-center hover:bg-primary/5 transition-colors"
          >
            <Link
              href={`/orgs/${orgId}/memberships/${m.userId}`}
              className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0"
            >
              <Avatar name={m.user.name} image={m.user.image} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {m.user.name ?? "Unnamed user"}
                </p>
                <RolesBadge roles={roles} />
              </div>
              <StatusBadge status={m.status} />
            </Link>
            {canManage && (
              <div className="pr-3 shrink-0">
                <MemberActions
                  orgId={orgId}
                  userId={m.userId}
                  memberName={m.user.name}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}