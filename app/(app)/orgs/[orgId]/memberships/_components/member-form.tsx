"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RolePicker } from "./role-picker";
import { DAYS } from "../_constants";
import {
  sendMemberInviteAction,
  updateMembershipAction,
} from "@/app/actions/memberships";

type Role = { id: string; name: string };

interface MemberFormProps {
  orgId: string;
  allRoles: Role[];
  mode: "create" | "edit";
  // Edit-only props
  userId?: string;
  initialRoleIds?: string[];
  initialWorkingDays?: string[];
  name?: string | null;
  email?: string;
  image?: string | null;
}

/**
 * Shared form used for both creating a new member and editing an existing one.
 *
 * Create mode: shows an email field, working days toggles, and a role picker.
 * Edit mode: shows the member's user info (read-only), working days, and roles pre-filled.
 *
 * Calls `sendMemberInviteAction` or `updateMembershipAction` via useTransition.
 */
export function MemberForm({
  orgId,
  allRoles,
  mode,
  userId,
  initialRoleIds = [],
  initialWorkingDays = [],
  name,
  email: initialEmail,
  image,
}: MemberFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [workingDays, setWorkingDays] = useState<string[]>(initialWorkingDays);
  const [roleIds, setRoleIds] = useState<string[]>(initialRoleIds);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function toggleDay(day: string) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function handleSubmit() {
    const next: Record<string, string> = {};
    if (mode === "create" && !email.trim()) next.email = "Email is required";
    if (roleIds.length === 0) next.roles = "At least one role is required";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});

    startTransition(async () => {
      if (mode === "create") {
        const result = await sendMemberInviteAction(orgId, {
          email,
          roleIds,
          workingDays,
        });
        if (!result.ok) {
          setErrors(
            result.field
              ? { [result.field]: result.error }
              : { _: result.error },
          );
          return;
        }
        router.push(`/orgs/${orgId}/memberships`);
      } else {
        const result = await updateMembershipAction(orgId, userId!, {
          workingDays,
          roleIds,
        });
        if (!result.ok) {
          setErrors({ _: result.error });
          return;
        }
        router.refresh();
      }
    });
  }

  const initials = (name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="rounded-xl border bg-card p-6 flex flex-col gap-6">
      {errors._ && <p className="text-sm text-destructive">{errors._}</p>}

      {/* Email (create) or user info display (edit) */}
      {mode === "create" ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            Email <span className="text-destructive">*</span>
          </label>
          <Input
            type="email"
            placeholder="member@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email}</p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-4">
          {image ? (
            <Image
              src={image}
              alt={name ?? "Member"}
              width={56}
              height={56}
              className="rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary font-semibold text-lg flex items-center justify-center shrink-0">
              {initials}
            </div>
          )}
          <div>
            <p className="font-medium text-sm">{name ?? "Unnamed user"}</p>
            <p className="text-sm text-muted-foreground">{initialEmail}</p>
          </div>
        </div>
      )}

      {/* Working days */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Working Days</label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleDay(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                workingDays.includes(key)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Roles */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          Roles <span className="text-destructive">*</span>
        </label>
        <RolePicker
          allRoles={allRoles}
          selectedIds={roleIds}
          onChange={setRoleIds}
        />
        {errors.roles && (
          <p className="text-xs text-destructive">{errors.roles}</p>
        )}
      </div>

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        size="sm"
        className="self-start"
      >
        {isPending
          ? mode === "create"
            ? "Inviting…"
            : "Saving…"
          : mode === "create"
            ? "Invite"
            : "Save"}
      </Button>
    </div>
  );
}
