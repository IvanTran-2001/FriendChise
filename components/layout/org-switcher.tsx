"use client";

/**
 * Dropdown that lets the user switch between their organizations.
 *
 * Derives the currently active org from the URL (e.g. `/orgs/[orgId]/...`)
 * and navigates to the selected org's root page on selection.
 */
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Org = { id: string; name: string; image: string | null };

/** Returns a stable hue (0–359) based on the org id string. */
function orgHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function OrgBadge({ org }: { org: Org }) {
  if (org.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={org.image}
        alt={org.name}
        className="h-5 w-5 shrink-0 rounded object-cover select-none"
        aria-hidden
      />
    );
  }
  const hue = orgHue(org.id);
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white select-none"
      style={{ background: `hsl(${hue} 60% 45%)` }}
      aria-hidden
    >
      {org.name[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

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
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 max-w-48 pl-1.5"
          disabled={isPending}
        >
          {activeOrg ? <OrgBadge org={activeOrg} /> : null}
          <span className="truncate max-w-28 sm:max-w-40">
            {activeOrg?.name ?? "Select Org"}
          </span>
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {orgs.length === 0 ? (
          <>
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              Organizations
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>No organizations</DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              Organizations
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {orgs.map((org) => {
              const isActive = org.id === activeOrgId;
              return (
                <DropdownMenuItem
                  key={org.id}
                  onSelect={() =>
                    startTransition(() => router.push(`/orgs/${org.id}`))
                  }
                  className="gap-2"
                >
                  <OrgBadge org={org} />
                  <span
                    className={cn("flex-1 truncate", isActive && "font-medium")}
                  >
                    {org.name}
                  </span>
                  {isActive && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
