"use client";

/**
 * AddBotPanel — inline bot-creation form for the ActionSidebar (desktop) or
 * AddBotDialog (mobile sheet).
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RolePicker } from "./role-picker";
import { DAYS } from "../_constants";
import { createBotAction } from "@/app/actions/bots";

type Role = { id: string; name: string };

export function AddBotPanel({
  orgId,
  roles,
  onClose,
}: {
  orgId: string;
  roles: Role[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [botName, setBotName] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function toggleDay(day: string) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!botName.trim()) {
      setErrors({ botName: "Name is required" });
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        const result = await createBotAction(orgId, {
          botName: botName.trim(),
          roleIds,
          workingDays,
        });
        if (!result.ok) {
          setErrors({ _: result.error });
          return;
        }
        toast.success(`Bot "${botName.trim()}" added.`);
        onClose();
      } catch (error: unknown) {
        setErrors({
          _: error instanceof Error ? error.message : String(error),
        });
        toast.error("Failed to add bot");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {errors._ && <p className="text-sm text-destructive">{errors._}</p>}

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

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Working Days</label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleDay(key)}
              aria-pressed={workingDays.includes(key)}
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
        <RolePicker
          allRoles={roles}
          selectedIds={roleIds}
          onChange={setRoleIds}
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Adding…" : "Add Bot"}
      </Button>
    </form>
  );
}

export function AddBotDialog({
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 flex flex-col rounded-t-2xl overflow-hidden">
        <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
          <SheetTitle>Add Bot</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <AddBotPanel
            orgId={orgId}
            roles={roles}
            onClose={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
