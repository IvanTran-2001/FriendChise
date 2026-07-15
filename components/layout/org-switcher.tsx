"use client";

/**
 * Dropdown that lets the user switch between their organizations.
 *
 * Derives the currently active org from the URL (e.g. `/orgs/[orgId]/...`)
 * and navigates to the selected org's root page on selection.
 */
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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

function toTourSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

export function OrgSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const activeOrgId = pathname.match(/^\/orgs\/([^\/]+)/)?.[1] ?? null;
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [recentOrgId, setRecentOrgId] = useState<string | null>(null);
  const [loadedOrgs, setLoadedOrgs] = useState<Org[]>([]);
  const [activeOrg, setActiveOrg] = useState<Org | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestSeqRef = useRef(0);

  const notifyDemoTourTargetChange = useCallback(() => {
    window.dispatchEvent(new Event("friendchise:demo-tour-targets-changed"));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setRecentOrgId(getRecentOrgId());
    });
  }, []);

  const mergeUniqueOrgs = useCallback((current: Org[], incoming: Org[]) => {
    const byId = new Map<string, Org>();
    for (const org of current) byId.set(org.id, org);
    for (const org of incoming) byId.set(org.id, org);
    return Array.from(byId.values());
  }, []);

  const loadOrgsPage = useCallback(
    async ({
      targetPage,
      replace,
      signal,
      requestSeq,
    }: {
      targetPage: number;
      replace: boolean;
      signal: AbortSignal;
      requestSeq: number;
    }) => {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("limit", "24");
      if (search.trim()) params.set("search", search.trim());
      if (activeOrgId) params.set("activeOrgId", activeOrgId);

      const response = await fetch(`/api/me/organizations?${params.toString()}`, { signal });
      if (!response.ok) throw new Error("Failed to load organizations.");

      const data = (await response.json()) as {
        organizations: Org[];
        activeOrganization: Org | null;
        totalPages: number;
        totalCount: number;
        page: number;
      };

      if (requestSeqRef.current !== requestSeq) return;

      setActiveOrg(data.activeOrganization);
      setLoadedOrgs((current) =>
        replace ? mergeUniqueOrgs([], data.organizations) : mergeUniqueOrgs(current, data.organizations),
      );
      setTotalPages(Math.max(1, data.totalPages));
      setPage(data.page);
    },
    [activeOrgId, mergeUniqueOrgs, search],
  );

  useEffect(() => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const controller = new AbortController();

    void (async () => {
      setIsLoadingInitial(true);
      setIsLoadingMore(false);
      setPage(0);
      setTotalPages(1);
      setLoadedOrgs([]);
      try {
        await loadOrgsPage({
          targetPage: 1,
          replace: true,
          signal: controller.signal,
          requestSeq,
        });
      } catch {
        if (requestSeqRef.current !== requestSeq) return;
        setLoadedOrgs([]);
        setActiveOrg(null);
        setTotalPages(1);
      } finally {
        if (requestSeqRef.current !== requestSeq) return;
        setIsLoadingInitial(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [activeOrgId, loadOrgsPage, search]);

  useEffect(() => {
    if (!open) return;
    if (isLoadingInitial || isLoadingMore) return;
    if (loadedOrgs.length === 0) return;
    if (page === 0 || page >= totalPages) return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (isLoadingInitial || isLoadingMore || page >= totalPages) return;

        const nextPage = page + 1;
        const requestSeq = requestSeqRef.current;
        const controller = new AbortController();
        setIsLoadingMore(true);

        void loadOrgsPage({
          targetPage: nextPage,
          replace: false,
          signal: controller.signal,
          requestSeq,
        })
          .catch(() => {
            // Retry on the next intersection.
          })
          .finally(() => {
            if (requestSeqRef.current !== requestSeq) return;
            setIsLoadingMore(false);
          });

        return () => controller.abort();
      },
      { root: scrollRootRef.current, rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoadingInitial, isLoadingMore, loadOrgsPage, loadedOrgs.length, open, page, totalPages]);

  // Sort orgs so the most recently selected one appears at the top.
  const sortedOrgs = useMemo(() => {
    if (!recentOrgId) return loadedOrgs;
    const idx = loadedOrgs.findIndex((o) => o.id === recentOrgId);
    if (idx < 1) return loadedOrgs; // already first or not found
    // Move the recent org to front, keep the rest in order
    return [loadedOrgs[idx], ...loadedOrgs.slice(0, idx), ...loadedOrgs.slice(idx + 1)];
  }, [loadedOrgs, recentOrgId]);

  const filteredOrgs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sortedOrgs;
    return sortedOrgs.filter((org) => org.name.toLowerCase().includes(query));
  }, [sortedOrgs, search]);

  const currentOrg = activeOrg ?? loadedOrgs.find((org) => org.id === activeOrgId) ?? null;
  const listOrgs = filteredOrgs.filter((org) => org.id !== currentOrg?.id);

  useEffect(() => {
    notifyDemoTourTargetChange();
  }, [currentOrg?.id, notifyDemoTourTargetChange, open]);

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
          data-tour-target="org-selector"
          className="group h-8.5 w-44 rounded-full border-border/70 bg-background/85 pl-1 pr-2 text-left shadow-sm transition-colors duration-150 hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
          disabled={isPending}
        >
          <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-muted/70 ring-1 ring-border/70 transition-colors group-hover:bg-muted">
            {currentOrg ? <OrgBadge org={currentOrg} /> : null}
          </span>
          <span className="flex min-w-0 flex-col items-start leading-none">
            <ScrollingText
              text={currentOrg?.name ?? "Select Org"}
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
        {isLoadingInitial && loadedOrgs.length === 0 ? (
          <div className="p-3">
            <div className="rounded-2xl border border-dashed bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
              Loading organizations…
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
                  {filteredOrgs.length}/{loadedOrgs.length}
                </span>
              </div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search organizations"
                className="h-9 rounded-xl border-border/70 bg-background/90 shadow-sm"
              />
            </div>

            <div ref={scrollRootRef} className="max-h-72 overflow-y-auto p-2">
              {currentOrg && (
                <div className="mb-2 rounded-2xl border border-primary/20 bg-primary/5 p-2">
                  <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Current organization
                  </div>
                  <DropdownMenuItem
                    key={currentOrg.id}
                    data-tour-target={
                      open && currentOrg.name === "Donut Shop A"
                        ? `org-selector-item-${toTourSlug(currentOrg.name)}`
                        : undefined
                    }
                    onSelect={() => {
                      setOpen(false);
                    }}
                    className={cn(
                      "group gap-2 rounded-2xl px-2.5 py-2.5 transition-all",
                      "bg-primary/8 text-foreground shadow-sm",
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border/70">
                      <OrgBadge org={currentOrg} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <ScrollingText text={currentOrg.name} className="text-sm font-semibold" />
                      <span className="truncate text-[11px] text-muted-foreground">Current organization</span>
                    </span>
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  </DropdownMenuItem>
                </div>
              )}

              {listOrgs.length === 0 ? (
                <DropdownMenuItem disabled className="justify-center rounded-xl py-3 text-sm text-muted-foreground">
                  {isLoadingMore ? "Loading more…" : "No matches"}
                </DropdownMenuItem>
              ) : (
                listOrgs.map((org) => {
                  const isActive = org.id === activeOrgId;
                  const isDonutShopA = org.name === "Donut Shop A";
                  const tourSlug = toTourSlug(org.name);
                  return (
                    <DropdownMenuItem
                      key={org.id}
                      data-tour-target={
                        open && isDonutShopA ? `org-selector-item-${tourSlug}` : undefined
                      }
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

              {open && page < totalPages && (
                <div
                  ref={sentinelRef}
                  className="my-2 flex items-center justify-center rounded-xl border bg-background/70 px-3 py-3 text-xs text-muted-foreground"
                >
                  {isLoadingMore ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading more organizations…
                    </span>
                  ) : (
                    <span>Scroll to load more organizations</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
