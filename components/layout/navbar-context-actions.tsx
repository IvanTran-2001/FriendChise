"use client";

import { usePathname, useParams } from "next/navigation";
import { TasksActions } from "@/components/layout/actions/tasks-actions";
import { MembersActions } from "@/components/layout/actions/members-actions";

export const NavbarContextActions = () => {
  const pathname = usePathname();
  const { orgId } = useParams<{ orgId?: string }>();

  if (orgId && pathname === `/orgs/${orgId}/tasks`) {
    return <TasksActions orgId={orgId} />;
  }

  if (orgId && pathname === `/orgs/${orgId}/memberships`) {
    return <MembersActions orgId={orgId} />;
  }

  return null;
};
