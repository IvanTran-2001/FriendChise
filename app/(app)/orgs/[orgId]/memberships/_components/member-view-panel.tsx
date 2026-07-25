"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
import { MemberForm } from "./member-form";
import { DAYS } from "../_constants";

type Role = { id: string; name: string; color: string };

interface MemberViewPanelProps {
  orgId: string;
  membershipId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isBot: boolean;
  workingDays: string[];
  roles: Role[];
  status: "ACTIVE" | "RESTRICTED";
  joinedAt: Date;
  canManage: boolean;
  allRoles: { id: string; name: string; color: string }[];
  initialRoleIds: string[];
  onMemberSaved: () => void;
}

export function MemberViewPanel({
  orgId,
  membershipId,
  name,
  email,
  image,
  isBot,
  workingDays,
  roles,
  status,
  joinedAt,
  canManage,
  allRoles,
  initialRoleIds,
  onMemberSaved,
}: MemberViewPanelProps) {
  const { open, close } = useActionSidebar();

  const displayName = name ?? "Unknown";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function handleEdit() {
    open(
      "Edit Member",
      <MemberForm
        orgId={orgId}
        allRoles={allRoles}
        mode="edit"
        membershipId={membershipId}
        isCurrentlyBot={isBot}
        initialRoleIds={initialRoleIds}
        initialWorkingDays={workingDays}
        name={displayName}
        image={image}
        onSuccess={() => {
          onMemberSaved();
          close();
        }}
      />,
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Avatar + name + badges */}
      <div className="flex items-center gap-3">
        {image ? (
          <Image
            src={image}
            alt={displayName}
            width={48}
            height={48}
            className="rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary font-semibold text-lg flex items-center justify-center shrink-0">
            {initials}
          </div>
        )}
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-sm font-semibold truncate">{displayName}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {isBot && (
              <span className="text-xs font-bold font-mono text-red-500 tracking-tight">
                Bot
              </span>
            )}
            {status === "RESTRICTED" && (
              <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-destructive/20 ring-inset">
                Restricted
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Email */}
      {!isBot && email && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Email
          </p>
          <p className="text-sm">{email}</p>
        </div>
      )}

      {/* Working days */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Working Days
        </p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(({ key, label }) => (
            <span
              key={key}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                workingDays.includes(key)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Roles */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Roles
        </p>
        <div className="flex flex-wrap gap-2">
          {roles.length > 0 ? (
            roles.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ backgroundColor: r.color + "22", color: r.color }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: r.color }}
                />
                {r.name}
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No roles</span>
          )}
        </div>
      </div>

      {/* Joined */}
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Joined
        </p>
        <p className="text-sm text-muted-foreground">
          {new Date(joinedAt).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {canManage && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleEdit}
          className="self-start"
        >
          Edit
        </Button>
      )}
    </div>
  );
}