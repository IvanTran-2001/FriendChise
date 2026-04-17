"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  deleteMembershipAction,
  setMemberStatusAction,
} from "@/app/actions/memberships";

interface MemberToolbarActionsProps {
  orgId: string;
  userId: string;
  memberName: string | null;
  status: "ACTIVE" | "RESTRICTED";
}

/**
 * Inline action buttons shown in the toolbar on the member detail and edit
 * pages. Replaces the previous "Actions" dropdown with explicit buttons for
 * Restrict/Unrestrict and Delete so actions are immediately discoverable.
 */
export function MemberToolbarActions({
  orgId,
  userId,
  memberName,
  status,
}: MemberToolbarActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restrictOpen, setRestrictOpen] = useState(false);

  const isRestricted = status === "RESTRICTED";

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMembershipAction(orgId, userId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/orgs/${orgId}/memberships`);
    });
  }

  function handleToggleRestrict() {
    const next = isRestricted ? "ACTIVE" : "RESTRICTED";
    startTransition(async () => {
      const result = await setMemberStatusAction(orgId, userId, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRestrictOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => setRestrictOpen(true)}
        >
          {isRestricted ? "Unrestrict" : "Restrict"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => setDeleteOpen(true)}
          className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          Delete
        </Button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium text-foreground">
                {memberName ?? "this member"}
              </span>{" "}
              from the org?
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

      <AlertDialog open={restrictOpen} onOpenChange={setRestrictOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRestricted ? "Unrestrict member?" : "Restrict member?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRestricted
                ? `${memberName ?? "This member"} will regain access to the org.`
                : `${memberName ?? "This member"} will be blocked from accessing the org until unrestricted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleRestrict}
              disabled={isPending}
            >
              {isRestricted ? "Unrestrict" : "Restrict"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
