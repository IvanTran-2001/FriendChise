"use client";

/**
 * Navbar action button for the Members page.
 * Renders a link-button that navigates to the add-member form for the given org.
 */
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const MembersActions = ({ orgId }: { orgId: string }) => {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={`/orgs/${orgId}/memberships/new`}>+ Add Member</Link>
    </Button>
  );
};
