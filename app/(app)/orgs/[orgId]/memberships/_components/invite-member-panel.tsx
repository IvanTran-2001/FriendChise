"use client";

/**
 * InviteMemberPanel — inline invite form for the ActionSidebar (desktop) or
 * InviteMemberDialog (mobile sheet).
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RolePicker } from "./role-picker";
import { DAYS } from "../_constants";
import { sendMemberInviteAction } from "@/app/actions/memberships";

type Role = { id: string; name: string };

export function InviteMemberPanel({
  orgId,
  roles,
  onClose,
}: {
  orgId: string;
  roles: Role[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function toggleDay(day: string) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function handleSubmit() {
    setErrors({});
    startTransition(async () => {
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
      toast.success("Invite sent!");
      onClose();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {errors._ && <p className="text-sm text-destructive">{errors._}</p>}

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

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Roles</label>
        <RolePicker allRoles={roles} selectedIds={roleIds} onChange={setRoleIds} />
      </div>

      <Button onClick={handleSubmit} disabled={isPending} className="w-full">
        {isPending ? "Sending…" : "Send Invite"}
      </Button>
    </div>
  );
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  orgId,
  roles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  roles: Role[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
        </DialogHeader>
        <InviteMemberPanel
          orgId={orgId}
          roles={roles}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
