"use client";

/**
 * MembersActions — action buttons rendered in the members sidebar.
 *
 * Desktop:
 *   - "Invite Member" opens InviteMemberPanel inside ActionSidebarSlot.
 *   - "Add Bot" opens AddBotPanel inside ActionSidebarSlot.
 *   The active button highlights (variant="default") when its panel is open.
 *
 * Mobile:
 *   - Both buttons close the mobile page-sidebar overlay and open a Dialog.
 *
 * Only rendered when canManage is true (enforced by MembersSidebarContent).
 */
import { useRef, useState } from "react";
import { UserPlus, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { InviteMemberPanel, InviteMemberDialog } from "./invite-member-panel";
import { AddBotPanel, AddBotDialog } from "./add-bot-panel";

type Role = { id: string; name: string };

export function MembersActions({
  orgId,
  roles,
}: {
  orgId: string;
  roles: Role[];
}) {
  const { open, close, activeTitle } = useActionSidebar();
  const isMobile = useIsMobile();
  const inviteKeyRef = useRef(0);
  const botKeyRef = useRef(0);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteDialogKey, setInviteDialogKey] = useState(0);
  const [botDialogOpen, setBotDialogOpen] = useState(false);
  const [botDialogKey, setBotDialogKey] = useState(0);

  function openInviteMember() {
    if (isMobile) {
      setInviteDialogKey((k) => k + 1);
      setInviteDialogOpen(true);
    } else {
      const k = ++inviteKeyRef.current;
      open(
        "Invite Member",
        <InviteMemberPanel
          key={k}
          orgId={orgId}
          roles={roles}
          onClose={close}
        />,
      );
    }
  }

  function openAddBot() {
    if (isMobile) {
      setBotDialogKey((k) => k + 1);
      setBotDialogOpen(true);
    } else {
      const k = ++botKeyRef.current;
      open(
        "Add Bot",
        <AddBotPanel key={k} orgId={orgId} roles={roles} onClose={close} />,
      );
    }
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

      <InviteMemberDialog
        key={`invite-${inviteDialogKey}`}
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        orgId={orgId}
        roles={roles}
      />
      <AddBotDialog
        key={`bot-${botDialogKey}`}
        open={botDialogOpen}
        onOpenChange={setBotDialogOpen}
        orgId={orgId}
        roles={roles}
      />
    </>
  );
}
