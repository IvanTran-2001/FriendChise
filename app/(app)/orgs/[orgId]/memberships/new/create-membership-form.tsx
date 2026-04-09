"use client";

import { MemberForm } from "../_components/member-form";

type Role = { id: string; name: string };

export function CreateMembershipForm({
  orgId,
  roles,
}: {
  orgId: string;
  roles: Role[];
}) {
  return <MemberForm mode="create" orgId={orgId} allRoles={roles} />;
}
