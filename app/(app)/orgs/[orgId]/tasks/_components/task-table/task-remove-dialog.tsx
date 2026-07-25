"use client";

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
import type { Task } from "./task-types";

interface TaskRemoveDialogProps {
  orgId: string;
  task: Task | null;
  onClose: () => void;
  onRemoveFromList: () => void;
  onDelete: () => void;
}

export function TaskRemoveDialog({
  orgId,
  task,
  onClose,
  onRemoveFromList,
  onDelete,
}: TaskRemoveDialogProps) {
  return (
    <AlertDialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove task</AlertDialogTitle>
          <AlertDialogDescription>
            {task?.orgId === orgId ? (
              <>
                How would you like to remove{" "}
                <span className="font-medium">{task?.name}</span>?
              </>
            ) : (
              <>
                Remove{" "}
                <span className="font-medium">{task?.name}</span> from your list?
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onRemoveFromList}>
            Remove from list
          </AlertDialogAction>
          {task?.orgId === orgId && (
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
            >
              {task._count.inheritedBy > 1 ? "Delete permanently" : "Delete"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
