"use client";

/**
 * Dropdown that lets the user switch between their organizations.
 *
 * Derives the currently active org from the URL (e.g. `/orgs/[orgId]/...`)
 * and navigates to the selected org's root page on selection.
 */
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ScrollingText } from "@/components/ui/scrolling-text";

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
        className="h-5 w-5 shrink-0 rounded-full object-cover select-none ring-1 ring-border/70"
        aria-hidden
      />
    );
  }
  const hue = orgHue(org.id);
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white select-none ring-1 ring-white/20"
      style={{ background: `hsl(${hue} 60% 45%)` }}
      aria-hidden
    >
      {org.name[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

const RECENT_ORG_KEY = "recentOrgId";

// Save the selected org id to localStorage so it appears at the top next time.
function saveRecentOrg(orgId: string) {
  try {
    localStorage.setItem(RECENT_ORG_KEY, orgId);
  } catch {
    // localStorage may be unavailable (incognito, SSR mock, etc.)
  }
}

// Read the previously selected org id from localStorage.
function getRecentOrgId(): string | null {
  try {
    return localStorage.getItem(RECENT_ORG_KEY);
  } catch {
    return null;
  }
}

export function OrgSwitcher({ orgs }: { orgs: Org[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [recentOrgId, setRecentOrgId] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setRecentOrgId(getRecentOrgId());
    });
  }, []);

  // Derive active org from the current URL e.g. /orgs/[orgId]/...
  const activeOrgId = pathname.match(/^\/orgs\/([^\/]+)/)?.[1];
  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  // Sort orgs so the most recently selected one appears at the top.
  const sortedOrgs = useMemo(() => {
    if (!recentOrgId) return orgs;
    const idx = orgs.findIndex((o) => o.id === recentOrgId);
    if (idx < 1) return orgs; // already first or not found
    // Move the recent org to front, keep the rest in order
    return [orgs[idx], ...orgs.slice(0, idx), ...orgs.slice(idx + 1)];
  }, [orgs, recentOrgId]);

  const filteredOrgs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sortedOrgs;
    return sortedOrgs.filter((org) => org.name.toLowerCase().includes(query));
  }, [sortedOrgs, search]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="group h-8.5 w-44 rounded-full border-border/70 bg-background/85 pl-1 pr-2 text-left shadow-sm transition-colors duration-150 hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
          disabled={isPending}
        >
          <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-muted/70 ring-1 ring-border/70 transition-colors group-hover:bg-muted">
            {activeOrg ? <OrgBadge org={activeOrg} /> : null}
          </span>
          <span className="flex min-w-0 flex-col items-start leading-none">
            <ScrollingText
              text={activeOrg?.name ?? "Select Org"}
              containerClassName="max-w-20 sm:max-w-28"
              className="text-[11px] font-medium"
            />
            <span className="mt-px text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Organization
            </span>
          </span>
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-76 overflow-hidden rounded-[1.25rem] border-border/70 bg-popover/95 p-0 shadow-2xl backdrop-blur-xl"
      >
        {orgs.length === 0 ? (
          <div className="p-3">
            <div className="rounded-2xl border border-dashed bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
              No organizations
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="border-b border-border/60 bg-background/60 p-3 pb-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <DropdownMenuLabel className="p-0 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Switch organization
                  </DropdownMenuLabel>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Search and jump between orgs
                  </p>
                </div>
                <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                  {filteredOrgs.length}/{orgs.length}
                </span>
              </div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search organizations"
                className="h-9 rounded-xl border-border/70 bg-background/90 shadow-sm"
              />
            </div>

            <div className="max-h-72 overflow-y-auto p-2">
              {filteredOrgs.length === 0 ? (
                <DropdownMenuItem disabled className="justify-center rounded-xl py-3 text-sm text-muted-foreground">
                  No matches
                </DropdownMenuItem>
              ) : (
                filteredOrgs.map((org) => {
                  const isActive = org.id === activeOrgId;
                  return (
                    <DropdownMenuItem
                      key={org.id}
                      onSelect={() => {
                        setRecentOrgId(org.id);
                        saveRecentOrg(org.id);
                        startTransition(() => router.push(`/orgs/${org.id}`));
                      }}
                      className={cn(
                        "group mb-1 gap-2 rounded-2xl px-2.5 py-2.5 transition-all last:mb-0",
                        isActive
                          ? "bg-primary/8 text-foreground shadow-sm"
                          : "hover:bg-muted/70",
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border/70">
                        <OrgBadge org={org} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <ScrollingText
                          text={org.name}
                          className={cn("text-sm", isActive && "font-semibold")}
                        />
                        <span className="truncate text-[11px] text-muted-foreground">
                          {isActive ? "Current organization" : "Tap to switch"}
                        </span>
                      </span>
                      {isActive && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                    </DropdownMenuItem>
                  );
                })
              )}
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
