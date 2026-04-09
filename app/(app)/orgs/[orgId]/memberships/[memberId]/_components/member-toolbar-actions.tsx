"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
 * Actions dropdown for toolbar on the member detail and edit pages.
 * Handles Restrict/Unrestrict and Delete with confirmation dialogs.
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
      await deleteMembershipAction(orgId, userId);
      router.push(`/orgs/${orgId}/memberships`);
    });
  }

  function handleToggleRestrict() {
    const next = isRestricted ? "ACTIVE" : "RESTRICTED";
    startTransition(async () => {
      const result = await setMemberStatusAction(orgId, userId, next);
      if (result.ok) router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isPending}
          >
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
              onClick={() => {
                setRestrictOpen(false);
                handleToggleRestrict();
              }}
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
