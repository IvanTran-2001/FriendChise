"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export const MembersActions = ({ orgId }: { orgId: string }) => {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={`/orgs/${orgId}/memberships/new`}>+ Add Member</Link>
    </Button>
  );
};
