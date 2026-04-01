"use client";

/**
 * TaskViewActions — Actions dropdown for the task view page.
 *
 * Renders an "Actions ▼" dropdown with:
 *   - Edit — navigates to the edit page via a Next.js Link.
 *   - Delete — shows an inline confirmation overlay, then calls
 *     `deleteTaskAction` and redirects to the tasks list on success.
 *
 * Shown only when the viewer holds `MANAGE_TASKS` (gated server-side in the
 * parent page; this component receives no auth props).
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
            Actions <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/orgs/${orgId}/tasks/${taskId}/edit`}>Edit</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setConfirming(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-lg p-6 shadow-xl flex flex-col gap-4 w-80">
            <p className="text-sm">
              Are you sure you want to remove <strong>{taskName}</strong>?
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending ? "Deleting..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
