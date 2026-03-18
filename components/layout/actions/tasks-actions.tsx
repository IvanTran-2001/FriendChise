"use client";

/**
 * Navbar action button for the Tasks page.
 * Renders a link-button that navigates to the create-task form for the given org.
 */
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const TasksActions = ({ orgId }: { orgId: string }) => {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={`/orgs/${orgId}/tasks/new`}>+ Create Task</Link>
    </Button>
  );
};
