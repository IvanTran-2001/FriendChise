"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export const TasksActions = ({ orgId }: { orgId: string }) => {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={`/orgs/${orgId}/tasks/new`}>+ Create Task</Link>
    </Button>
  );
};
