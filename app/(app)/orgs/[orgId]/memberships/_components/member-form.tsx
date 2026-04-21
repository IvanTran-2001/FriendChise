"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RolePicker } from "./role-picker";
import { DAYS } from "../_constants";
import {
  sendMemberInviteAction,
  updateMembershipAction,
} from "@/app/actions/memberships";
import { createBotAction, memberToBotAction, inviteBotSlotAction, updateBotAction } from "@/app/actions/bots";

type Role = { id: string; name: string };

interface MemberFormProps {
  orgId: string;
  allRoles: Role[];
  mode: "create" | "edit";
  // Edit-only props
  membershipId?: string;
  /** True when editing an existing bot slot (userId === null) */
  isCurrentlyBot?: boolean;
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
  membershipId,
  isCurrentlyBot = false,
  initialRoleIds = [],
  initialWorkingDays = [],
  name,
  email: initialEmail,
  image,
}: MemberFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isInvitePending, startInviteTransition] = useTransition();
  // email is used in create mode and for the member-to-bot conversion check
  const [email, setEmail] = useState(
    mode === "edit" && !isCurrentlyBot ? (initialEmail ?? "") : "",
  );
  // inviteEmail is only used in bot-edit mode's invite section
  const [inviteEmail, setInviteEmail] = useState("");
  // botName is used in create-bot mode AND in bot-edit mode (initialized to current name)
  const [botName, setBotName] = useState(
    isCurrentlyBot && mode === "edit" ? (name ?? "") : "",
  );
  const [workingDays, setWorkingDays] = useState<string[]>(initialWorkingDays);
  const [roleIds, setRoleIds] = useState<string[]>(initialRoleIds);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

  // In create mode: empty email = creating a new bot
  // In edit mode on a non-bot member: empty email = convert to bot
  const isBot = email.trim() === "";
  const isMemberToBot = mode === "edit" && !isCurrentlyBot && isBot;

  function toggleDay(day: string) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function handleSubmit() {
    const next: Record<string, string> = {};
    if (mode === "create" && isBot && !botName.trim())
      next.botName = "Name is required for a bot";
    if (isMemberToBot && !botName.trim())
      next.botName = "Bot name is required";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});

    startTransition(async () => {
      if (mode === "create") {
        if (isBot) {
          const result = await createBotAction(orgId, {
            botName: botName.trim(),
            roleId: roleIds[0] ?? "",
            workingDays,
          });
          if (!result.ok) { setErrors({ _: result.error }); return; }
          toast.success(`Bot "${botName.trim()}" added.`);
        } else {
          const result = await sendMemberInviteAction(orgId, { email, roleIds, workingDays });
          if (!result.ok) {
            setErrors(result.field ? { [result.field]: result.error } : { _: result.error });
            return;
          }
        }
        router.push(`/orgs/${orgId}/memberships`);
      } else if (isMemberToBot) {
        // Editing a real member: convert them to a bot
        const result = await memberToBotAction(orgId, {
          membershipId: membershipId!,
          overrideName: botName.trim() || undefined,
        });
        if (!result.ok) { setErrors({ _: result.error }); return; }
        toast.success("Member converted to bot.");
        router.push(`/orgs/${orgId}/memberships`);
      } else {
        // Normal edit (non-bot): update working days and roles
        const result = await updateMembershipAction(orgId, membershipId!, {
          workingDays,
          roleIds,
        });
        if (!result.ok) { setErrors({ _: result.error }); return; }
        toast.success(`${name ?? "Member"} updated.`);
        router.push(`/orgs/${orgId}/memberships/${membershipId}`);
      }
    });
  }

  // Saves bot name, working days, and roles for a bot slot.
  function handleSaveBotProps() {
    if (!botName.trim()) {
      setErrors({ botName: "Bot name is required" });
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await updateBotAction(orgId, membershipId!, {
        botName: botName.trim(),
        workingDays,
        roleIds,
      });
      if (!result.ok) { setErrors({ _: result.error }); return; }
      toast.success("Bot updated.");
      router.push(`/orgs/${orgId}/memberships/${membershipId}`);
    });
  }

  // Sends an invite for someone to fill this bot slot.
  function handleSendBotInvite() {
    if (!inviteEmail.trim()) {
      setInviteErrors({ email: "Email is required" });
      return;
    }
    setInviteErrors({});
    startInviteTransition(async () => {
      const result = await inviteBotSlotAction(orgId, membershipId!, { email: inviteEmail });
      if (!result.ok) { setInviteErrors({ email: result.error }); return; }
      toast.success("Invite sent! They\'ll be slotted in when they accept.");
      router.push(`/orgs/${orgId}/memberships/${membershipId}`);
    });
  }


  const initials = (name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // ── Bot edit mode: two separate sections ───────────────────────────────────
  if (mode === "edit" && isCurrentlyBot) {
    return (
      <div className="flex flex-col gap-4">
        {/* Section 1: Bot settings */}
        <div className="rounded-xl border bg-card p-6 flex flex-col gap-6">
          <h3 className="text-sm font-semibold text-foreground">Bot Settings</h3>
          {errors._ && <p className="text-sm text-destructive">{errors._}</p>}

          {/* Bot name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Bot Name <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Open Slot"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
            />
            {errors.botName && (
              <p className="text-xs text-destructive">{errors.botName}</p>
            )}
          </div>

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
            <label className="text-sm font-medium">Roles</label>
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
            onClick={handleSaveBotProps}
            disabled={isPending}
            size="sm"
            className="self-start"
          >
            {isPending ? "Saving…" : "Save Bot"}
          </Button>
        </div>

        {/* Section 2: Invite to fill slot */}
        <div className="rounded-xl border bg-card p-6 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Invite to Fill Slot</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Send an invite to someone to fill this bot slot. They&apos;ll take over all
              assigned tasks and shifts when they accept.
            </p>
          </div>
          {inviteErrors._ && (
            <p className="text-sm text-destructive">{inviteErrors._}</p>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="member@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            {inviteErrors.email && (
              <p className="text-xs text-destructive">{inviteErrors.email}</p>
            )}
          </div>
          <Button
            type="button"
            onClick={handleSendBotInvite}
            disabled={isInvitePending}
            size="sm"
            variant="outline"
            className="self-start"
          >
            {isInvitePending ? "Sending Invite…" : "Send Invite"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Create mode / normal member edit ───────────────────────────────────────
  return (
    <div className="rounded-xl border bg-card p-6 flex flex-col gap-6">
      {errors._ && <p className="text-sm text-destructive">{errors._}</p>}

      {/* Email (create) or user info display (edit) */}
      {mode === "create" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="member@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (e.target.value.trim()) setBotName("");
              }}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Leave blank to add a bot placeholder instead.
            </p>
          </div>

          {isBot && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Bot name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Open Slot"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
              />
              {errors.botName && (
                <p className="text-xs text-destructive">{errors.botName}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
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
            <p className="font-medium text-sm">{name ?? "Unnamed user"}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="member@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (e.target.value.trim()) setBotName("");
              }}
            />
            <p className="text-xs text-muted-foreground">
              Clear this field to convert the member into a bot placeholder.
            </p>          </div>

          {isMemberToBot && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Bot name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder={name ?? "e.g. Open Slot"}
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
              />
              {errors.botName && (
                <p className="text-xs text-destructive">{errors.botName}</p>
              )}
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Saving will remove this member&apos;s account link and convert them to a bot. This cannot be undone from this form.
              </p>
            </div>
          )}
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
        <label className="text-sm font-medium">Roles</label>
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
            ? isBot ? "Adding…" : "Inviting…"
            : isMemberToBot ? "Converting…"
            : "Saving…"
          : mode === "create"
            ? isBot ? "Add Bot" : "Invite"
            : isMemberToBot ? "Convert to Bot"
            : "Save"}
      </Button>
    </div>
  );
}
