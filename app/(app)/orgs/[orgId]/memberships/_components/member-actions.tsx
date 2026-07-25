"use client";

import { useState, useTransition } from "react";
import { MoreVertical } from "lucide-react";
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
} from "@/components/ui/dialogs/alert-dialog";
import { toast } from "sonner";
import { deleteMembershipAction } from "@/app/actions/memberships";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
import { MemberForm } from "./member-form";

type Role = { id: string; name: string; color: string };

interface MemberActionsProps {
  orgId: string;
  membershipId: string;
  memberName: string | null;
  email?: string;
  allRoles: Role[];
  isCurrentlyBot: boolean;
  initialRoleIds: string[];
  initialWorkingDays: string[];
  image: string | null;
  onDeleted: () => void;
}

/**
 * [...] dropdown shown on each member row / card (only when canManage).
 * Provides Edit (links to detail page), Restrict (stub), and Delete
 * (with an AlertDialog confirmation before calling the server action).
 */
export function MemberActions({
  orgId,
  membershipId,
  memberName,
  email,
  allRoles,
  isCurrentlyBot,
  initialRoleIds,
  initialWorkingDays,
  image,
  onDeleted,
}: MemberActionsProps) {
  const { open, close } = useActionSidebar();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleEdit() {
    open(
      "Edit Member",
      <MemberForm
        orgId={orgId}
        allRoles={allRoles}
        mode="edit"
        membershipId={membershipId}
        isCurrentlyBot={isCurrentlyBot}
        initialRoleIds={initialRoleIds}
        initialWorkingDays={initialWorkingDays}
        name={memberName}
        email={email}
        image={image}
        onSuccess={close}
      />,
    );
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMembershipAction(orgId, membershipId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirmOpen(false);
      toast.success(`Member deleted successfully!`);
      onDeleted();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Member actions"
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              /* Restrict — not yet implemented */
            }}
            disabled
          >
            Restrict
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium text-foreground">
                {memberName ?? "this member"}
              </span>{" "}
              from the org? They will be unassigned from all tasks they are
              currently assigned to.
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
    </>
  );
}
