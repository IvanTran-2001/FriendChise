"use client";

/**
 * TaskViewActions — Actions for the task view page.
 *
 * Renders an Edit button (navigates to edit page) and a Delete button
 * (shows an inline confirmation overlay, then calls `deleteTaskAction`
 * and redirects to the tasks list on success).
 *
 * Shown only when the viewer holds `MANAGE_TASKS` (gated server-side in the
 * parent page; this component receives no auth props).
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
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
import { deleteTaskAction } from "@/app/actions/tasks";

interface Props {
  orgId: string;
  taskId: string;
  taskName: string;
}

export function TaskViewActions({ orgId, taskId, taskName }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteTaskAction(orgId, taskId);
      if (res.ok) {
        router.push(`/orgs/${orgId}/tasks`);
      } else {
        toast.error(res.error);
        setConfirming(false);
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-2 shrink-0 ml-auto" data-testid="task-actions">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/orgs/${orgId}/tasks/${taskId}/edit`}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Delete
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{taskName}</strong>? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
