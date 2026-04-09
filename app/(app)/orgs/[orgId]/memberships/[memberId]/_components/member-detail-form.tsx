"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Toolbar } from "@/components/layout/toolbar";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  updateMembershipAction,
  deleteMembershipAction,
  setMemberStatusAction,
} from "@/app/actions/memberships";

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

type Role = { id: string; name: string };

interface MemberDetailFormProps {
  orgId: string;
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  joinedAt: Date;
  workingDays: string[];
  currentRoleId: string | null;
  status: "ACTIVE" | "RESTRICTED";
  roles: Role[];
  canManage: boolean;
}

/**
 * Client form for the member detail page.
 * Handles editing working days and role, plus the Restrict/Delete actions.
 */
export function MemberDetailForm({
  orgId,
  userId,
  name,
  email,
  image,
  joinedAt,
  workingDays: initialWorkingDays,
  currentRoleId: initialRoleId,
  status,
  roles,
  canManage,
}: MemberDetailFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restrictOpen, setRestrictOpen] = useState(false);

  const [workingDays, setWorkingDays] = useState<string[]>(initialWorkingDays);
  const [roleId, setRoleId] = useState<string>(initialRoleId ?? "");
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: string) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function handleSave() {
    if (!roleId) { setError("Please select a role."); return; }
    setError(null);
    startTransition(async () => {
      const result = await updateMembershipAction(orgId, userId, { workingDays, roleIds: roleId ? [roleId] : [] });
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteMembershipAction(orgId, userId);
      router.push(`/orgs/${orgId}/memberships`);
    });
  }

  function handleToggleRestrict() {
    const next = status === "ACTIVE" ? "RESTRICTED" : "ACTIVE";
    startTransition(async () => {
      const result = await setMemberStatusAction(orgId, userId, next);
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    });
  }

  const isRestricted = status === "RESTRICTED";

  return (
    <>
      <Toolbar>
        <Link
          href={`/orgs/${orgId}/memberships`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Members
        </Link>
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button size="sm" onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    Actions <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setRestrictOpen(true)}>
                    {isRestricted ? "Unrestrict" : "Restrict"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => setDeleteOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </Toolbar>

      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="rounded-xl border bg-card p-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8">
          {/* Left: fields */}
          <dl className="flex flex-col gap-5">
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Full Name</dt>
              <dd className="text-sm font-medium">{name ?? "—"}</dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email</dt>
              <dd className="text-sm">{email}</dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Working Days</dt>
              <dd className="flex flex-wrap gap-2">
                {DAYS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    disabled={!canManage}
                    onClick={() => toggleDay(key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                      ${workingDays.includes(key)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                      }
                      disabled:pointer-events-none`}
                  >
                    {label}
                  </button>
                ))}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Role</dt>
              <dd>
                {canManage ? (
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="">Select a role…</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm">
                    {roles.find((r) => r.id === roleId)?.name ?? "—"}
                  </span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</dt>
              <dd>
                {isRestricted ? (
                  <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-destructive/20 ring-inset">
                    Restricted
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Active</span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Join Date</dt>
              <dd className="text-sm text-muted-foreground">
                {new Date(joinedAt).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </div>
          </dl>

          {/* Right: avatar */}
          <div className="flex flex-col items-center gap-2">
            {image ? (
              <Image
                src={image}
                alt={name ?? "Member"}
                width={96}
                height={96}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary/10 text-primary font-semibold text-2xl flex items-center justify-center">
                {(name ?? "?")
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium text-foreground">{name ?? "this member"}</span>{" "}
              from the org? They will be unassigned from all tasks they are currently
              assigned to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restrict confirmation */}
      <AlertDialog open={restrictOpen} onOpenChange={setRestrictOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRestricted ? "Unrestrict member?" : "Restrict member?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRestricted
                ? `${name ?? "This member"} will regain access to the org.`
                : `${name ?? "This member"} will be blocked from accessing the org until unrestricted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setRestrictOpen(false); handleToggleRestrict(); }} disabled={isPending}>
              {isRestricted ? "Unrestrict" : "Restrict"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
