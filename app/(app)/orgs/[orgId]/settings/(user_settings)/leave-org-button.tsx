"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { leaveOrgAction } from "@/app/actions/memberships";
import { 
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";

export function LeaveOrgButton({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" disabled={isPending}>
          {isPending ? "Leaving..." : "Leave Organization"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave Organization</DialogTitle>
          <DialogDescription>
            Are you sure you want to leave this organization? This action will
            convert your membership to a placeholder. You will lose access to
            its content and resources.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const result = await leaveOrgAction(orgId);
                if (result && !result.ok) {
                  alert(result.error);
                  setOpen(false);
                }
              });
            }}
          >
            {isPending ? "Leaving..." : "Leave"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
