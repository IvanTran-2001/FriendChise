"use client";

/**
 * Dropdown that lets the user switch between their organizations.
 *
 * Derives the currently active org from the URL (e.g. `/orgs/[orgId]/...`)
 * and navigates to the selected org's root page on selection.
 */
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Org = { id: string; name: string };

export function OrgSwitcher({ orgs }: { orgs: Org[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Derive active org from the current URL e.g. /orgs/[orgId]/...
  const activeOrgId = pathname.match(/^\/orgs\/([^\/]+)/)?.[1];
  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 max-w-48" disabled={isPending}>
          <span className="truncate max-w-28 sm:max-w-40">{activeOrg?.name ?? "Select Org"}</span>
          {isPending
            ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-50" />
            : <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {orgs.length === 0 ? (
          <DropdownMenuItem disabled>No organizations</DropdownMenuItem>
        ) : (
          orgs.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onSelect={() => startTransition(() => router.push(`/orgs/${org.id}/timetable`))}
            >
              {org.name}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
