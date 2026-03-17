"use client";

/**
 * Client boundary for route-aware navbar actions.
 *
 * NavBar is a server component (it fetches session + orgs), so it cannot use
 * client hooks. This component is the minimal client slice that reads the
 * current URL and renders the appropriate action button for the active page.
 *
 * To add actions for a new page, create a file in components/layout/actions/
 * and add an `if` branch here.
 */

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
