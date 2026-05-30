/**
 * Dev-only sign-in picker rendered on the sign-in page when
 * `NODE_ENV === "development"`. Displays a searchable, scrollable list of
 * pre-seeded test users so engineers can switch accounts without OAuth.
 *
 * Rendered by `app/(auth)/signin/page.tsx` inside a
 * `process.env.NODE_ENV === "development"` guard — never shipped to prod.
 */
"use client";

import { useState, useTransition } from "react";
import { devSignIn } from "./dev-sign-in-action";

const USERS = [
  { email: "owner@example.test",  label: "MainDev",  role: "Owner" },
  { email: "jordan@example.test", label: "Jordan",   role: "Shift Lead" },
  { email: "casey@example.test",  label: "Casey",    role: "Fryer Op" },
  { email: "riley@example.test",  label: "Riley",    role: "Shift Lead + Fryer" },
  { email: "alex@example.test",   label: "Alex",     role: "Trainee" },
  { email: "morgan@example.test", label: "Morgan",   role: "" },
  { email: "taylor@example.test", label: "Taylor",   role: "" },
  { email: "sam@example.test",    label: "Sam",      role: "" },
  { email: "quinn@example.test",  label: "Quinn",    role: "" },
];

export function DevUserPicker({ callbackUrl }: { callbackUrl: string }) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [signingIn, setSigningIn] = useState<string | null>(null);

  const filtered = USERS.filter(
    (u) =>
      u.label.toLowerCase().includes(query.toLowerCase()) ||
      u.role.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase()),
  );

  function handleSignIn(email: string) {
    setSigningIn(email);
    startTransition(() => devSignIn(email, callbackUrl));
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-dashed border-yellow-500/50 bg-yellow-500/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-yellow-600 dark:text-yellow-400">
        Dev — sign in as seeded user
      </p>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search users…"
        className="mt-3 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />

      <div className="mt-2 max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No users match.</p>
        ) : (
          filtered.map(({ email, label, role }) => (
            <button
              key={email}
              type="button"
              disabled={pending}
              onClick={() => handleSignIn(email)}
              className="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:opacity-50"
            >
              <span className="font-medium text-foreground">
                {signingIn === email ? "Signing in…" : label}
              </span>
              {role && (
                <span className="text-xs text-muted-foreground">{role}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
