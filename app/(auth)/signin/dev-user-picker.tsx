/**
 * Dev-only sign-in picker rendered on the sign-in page when
 * `NODE_ENV === "development"`. Displays a searchable, scrollable list of
 * pre-seeded test users so engineers can switch accounts without OAuth.
 *
 * Rendered by `app/(auth)/signin/page.tsx` inside a
 * `process.env.NODE_ENV === "development"` guard — never shipped to prod.
 */
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bug, Minimize2, Search, Users } from "lucide-react";
import { devSignIn } from "./dev-sign-in-action";
import type { DevUser } from "./get-dev-users";
import { useIsMobile } from "@/hooks/use-mobile";

export function DevUserPicker({
  callbackUrl,
  users,
}: {
  callbackUrl: string;
  users: DevUser[];
}) {
  const isMobile = useIsMobile();
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isCollapsed = isMobile === true ? !isMobileOpen : !isDesktopOpen;
  const isBreakpointResolved = isMobile !== undefined;

  useEffect(() => {
    if (!isBreakpointResolved || isCollapsed) return;
    searchRef.current?.focus();
  }, [isBreakpointResolved, isCollapsed]);

  if (!isBreakpointResolved) {
    return null;
  }

  const filtered = users.filter(
    (u) =>
      u.label.toLowerCase().includes(query.toLowerCase()) ||
      u.role.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase()),
  );

  function handleSignIn(email: string) {
    setSigningIn(email);
    startTransition(() => devSignIn(email, callbackUrl));
  }

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={() =>
          isMobile === true ? setIsMobileOpen(true) : setIsDesktopOpen(true)
        }
        aria-label="Expand dev sign in"
        title="Expand dev sign in"
        className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-full border border-yellow-500/40 bg-yellow-500/15 px-3 py-2 text-xs font-semibold text-yellow-700 shadow-lg shadow-amber-500/10 backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-yellow-500/20 focus:outline-none focus:ring-2 focus:ring-yellow-500/40 dark:text-yellow-300 md:top-4 md:bottom-auto"
      >
        <Users className="h-4 w-4" />
        <span>Dev sign in</span>
        <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Open
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-88 max-w-[calc(100vw-2rem)] rounded-2xl border border-dashed border-yellow-500/50 bg-yellow-500/8 p-4 shadow-xl backdrop-blur-sm md:top-4 md:bottom-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-yellow-600 dark:text-yellow-400">
            Dev sign in
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Search seeded users and switch accounts without OAuth.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            isMobile === true ? setIsMobileOpen(false) : setIsDesktopOpen(false)
          }
          aria-label="Minimize dev sign in picker"
          title="Minimize dev sign in picker"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground shadow-sm transition hover:-translate-y-0.5 hover:text-foreground"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      </div>

      <label className="mt-3 flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users…"
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </label>

      <div className="mt-3 max-h-52 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            No users match.
          </p>
        ) : (
          filtered.map(({ email, label, role }) => (
            <button
              key={email}
              type="button"
              disabled={pending}
              onClick={() => handleSignIn(email)}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="font-medium text-foreground">
                {signingIn === email ? "Signing in…" : label}
              </span>
              {role ? (
                <span className="ml-3 truncate text-xs text-muted-foreground">
                  {role}
                </span>
              ) : (
                <Bug className="ml-3 h-4 w-4 shrink-0 text-muted-foreground/60" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
