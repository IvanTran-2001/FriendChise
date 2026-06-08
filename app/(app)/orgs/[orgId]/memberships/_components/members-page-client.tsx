"use client";

import { useState } from "react";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { MembersSidebarContent } from "./members-sidebar-content";
import { MembersView } from "./members-view";

type Role = { id: string; name: string; color: string };

type Member = {
  id: string;
  userId: string | null;
  botName: string | null;
  status: "ACTIVE" | "RESTRICTED";
  workingDays: string[];
  joinedAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  memberRoles: { role: { id: string; name: string; color: string } }[];
};

interface MembersPageClientProps {
  orgId: string;
  members: Member[];
  roles: Role[];
  canManage: boolean;
  roleId: string | null;
  view: "list" | "card";
}

export function MembersPageClient({
  orgId,
  members,
  roles,
  canManage,
  roleId,
  view,
}: MembersPageClientProps) {
  const [currentView, setCurrentView] = useState<"list" | "card">(view);

  return (
    <>
      <RegisterPageSidebarSubContent
        content={
          <MembersSidebarContent
            orgId={orgId}
            roles={roles}
            canManage={canManage}
            roleId={roleId}
            view={currentView}
            onViewChange={setCurrentView}
          />
        }
      />
      <MembersView
        members={members}
        orgId={orgId}
        canManage={canManage}
        allRoles={roles}
        roleId={roleId}
        view={currentView}
      />
    </>
  );
}