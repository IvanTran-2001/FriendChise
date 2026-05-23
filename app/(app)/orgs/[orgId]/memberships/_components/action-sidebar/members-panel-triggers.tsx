"use client";

/**
 * MembersActions — action buttons rendered in the members sidebar.
 *
 * "Invite Member" and "Add Bot" open their respective panels inside
 * ActionSidebarSlot (desktop: inline sidebar, mobile: bottom sheet).
 *
 * Only rendered when canManage is true (enforced by MembersSidebarContent).
 */
import { useRef } from "react";
import { UserPlus, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { InviteMemberPanel } from "./invite-member-panel";
import { AddBotPanel } from "./add-bot-panel";

type Role = { id: string; name: string; color: string };

export function MembersActions({
  orgId,
  roles,
}: {
  orgId: string;
  roles: Role[];
}) {
  const { open, close, activeTitle } = useActionSidebar();
  const inviteKeyRef = useRef(0);
  const botKeyRef = useRef(0);

  function openInviteMember() {
    const k = ++inviteKeyRef.current;
    open(
      "Invite Member",
      <InviteMemberPanel key={k} orgId={orgId} roles={roles} onClose={close} />,
    );
  }

  function openAddBot() {
    const k = ++botKeyRef.current;
    open(
      "Add Bot",
      <AddBotPanel key={k} orgId={orgId} roles={roles} onClose={close} />,
    );
  }

  return (
    <>
      <Button
        variant={activeTitle === "Invite Member" ? "default" : "outline"}
        size="sm"
        onClick={openInviteMember}
        className="w-full justify-start gap-2"
      >
        <UserPlus className="h-4 w-4 shrink-0" />
        Invite Member
      </Button>
      <Button
        variant={activeTitle === "Add Bot" ? "default" : "outline"}
        size="sm"
        onClick={openAddBot}
        className="w-full justify-start gap-2"
      >
        <Bot className="h-4 w-4 shrink-0" />
        Add Bot
      </Button>
    </>
  );
}
