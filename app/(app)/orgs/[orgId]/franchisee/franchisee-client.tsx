"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  KeyRound,
  MoreHorizontal,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  changeFranchiseeOwner,
  deleteFranchiseToken,
  extendFranchiseToken,
  generateFranchiseToken,
  removeFranchisee,
} from "@/app/actions/franchisee";

type Franchisee = {
  id: string;
  name: string;
  address: string | null;
  createdAt: Date;
  owner: { id: string; name: string | null; email: string | null } | null;
};

type Token = {
  id: string;
  token: string;
  invitedEmail: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  usedByOrgId: string | null;
};

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString("en-AU", {
    timeZone: "UTC",
  });
}

function FranchiseeActions({
  orgId,
  franchisee,
}: {
  orgId: string;
  franchisee: Franchisee;
}) {
  const [mode, setMode] = useState<"closed" | "menu" | "delete" | "changeOwner">("closed");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const reset = () => {
    setMode("closed");
    setNewOwnerEmail("");
    setError("");
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await removeFranchisee(orgId, franchisee.id);
      if (res.ok) {
        reset();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  const handleChangeOwner = () => {
    const trimmedEmail = newOwnerEmail.trim();
    if (!trimmedEmail || isPending) return;
    startTransition(async () => {
      const res = await changeFranchiseeOwner(orgId, franchisee.id, trimmedEmail);
      if (res.ok) {
        reset();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        aria-label={`Open actions for ${franchisee.name}`}
        onClick={() => setMode("menu")}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      <Dialog open={mode === "menu"} onOpenChange={(open) => !open && reset()}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{franchisee.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1 -mx-2">
            <button
              className="w-full rounded-md px-4 py-2.5 text-left text-sm hover:bg-accent"
              onClick={() => setMode("changeOwner")}
            >
              Change Owner
            </button>
            <button
              className="w-full rounded-md px-4 py-2.5 text-left text-sm text-destructive hover:bg-accent"
              onClick={() => setMode("delete")}
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "delete"} onOpenChange={(open) => !open && reset()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete franchisee</DialogTitle>
            <DialogDescription>
              This will permanently delete <span className="font-medium text-foreground">{franchisee.name}</span> and all its data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={reset} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "changeOwner"} onOpenChange={(open) => !open && reset()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Owner</DialogTitle>
            <DialogDescription>
              Enter the email of the new owner for <span className="font-medium text-foreground">{franchisee.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="New owner email"
            value={newOwnerEmail}
            onChange={(e) => setNewOwnerEmail(e.target.value)}
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.repeat) handleChangeOwner();
            }}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={reset} disabled={isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleChangeOwner} disabled={isPending || !newOwnerEmail.trim()}>
              {isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TokenActions({ orgId, token }: { orgId: string; token: Token }) {
  const [mode, setMode] = useState<"closed" | "menu" | "delete">("closed");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setMode("closed");
    setError("");
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteFranchiseToken(orgId, token.id);
      if (res.ok) reset();
      else setError(res.error);
    });
  };

  const handleExtend = () => {
    startTransition(async () => {
      const res = await extendFranchiseToken(orgId, token.id);
      if (res.ok) reset();
      else setError(res.error);
    });
  };

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        aria-label={`Open token actions for ${token.invitedEmail}`}
        onClick={() => setMode("menu")}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      <Dialog open={mode === "menu"} onOpenChange={(open) => !open && reset()}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{token.invitedEmail}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1 -mx-2">
            <button
              className="w-full rounded-md px-4 py-2.5 text-left text-sm hover:bg-accent"
              onClick={handleExtend}
              disabled={isPending}
            >
              {isPending ? "…" : "Extend (+1 day)"}
            </button>
            <button
              className="w-full rounded-md px-4 py-2.5 text-left text-sm text-destructive hover:bg-accent"
              onClick={() => setMode("delete")}
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "delete"} onOpenChange={(open) => !open && reset()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete token</DialogTitle>
            <DialogDescription>
              Delete the invite token for <span className="font-medium text-foreground">{token.invitedEmail}</span>?
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={reset} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FranchiseeClient({
  orgId,
  franchisees,
  tokens,
}: {
  orgId: string;
  franchisees: Franchisee[];
  tokens: Token[];
}) {
  const [email, setEmail] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [isPending, startTransition] = useTransition();

  const activeTokens = tokens.filter(
    (token) => !token.acceptedAt && new Date(token.expiresAt) >= new Date(),
  ).length;
  const expiredTokens = tokens.filter(
    (token) => !token.acceptedAt && new Date(token.expiresAt) < new Date(),
  ).length;
  const usedTokens = tokens.filter((token) => !!token.acceptedAt).length;

  const handleGenerateToken = () => {
    const trimmedEmail = email.trim();
    if (isPending || !trimmedEmail) return;
    setTokenError("");
    startTransition(async () => {
      const res = await generateFranchiseToken(orgId, trimmedEmail);
      if (res.ok) setEmail("");
      else setTokenError(res.error);
    });
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-background via-background to-primary/5 shadow-sm">
        <div className="flex flex-col gap-5 p-6 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Building2 className="h-3.5 w-3.5" />
              Franchise management
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Franchisees & invite tokens
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Review every franchisee under this parent org, manage ownership,
                and generate or rotate invite tokens from one place.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-full lg:max-w-3xl">
            {[
              { label: "Franchisees", value: franchisees.length, icon: Users, tone: "text-foreground" },
              { label: "Active tokens", value: activeTokens, icon: KeyRound, tone: "text-primary" },
              { label: "Expired / used", value: `${expiredTokens} / ${usedTokens}`, icon: Clock3, tone: "text-muted-foreground" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{stat.label}</span>
                  <stat.icon className={cn("h-4 w-4", stat.tone)} />
                </div>
                <div className={cn("mt-2 text-2xl font-semibold tracking-tight", stat.tone)}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Franchisee list
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {franchisees.length === 0
                ? "No franchisees yet."
                : `${franchisees.length} franchisee${franchisees.length === 1 ? "" : "s"} connected to this parent org.`}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Managed network
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Name</th>
                <th className="hidden px-5 py-3 text-left font-medium sm:table-cell">Location</th>
                <th className="hidden px-5 py-3 text-left font-medium sm:table-cell">Owner</th>
                <th className="hidden px-5 py-3 text-left font-medium sm:table-cell">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {franchisees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">No franchisees yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Generate an invite token below to add the first one.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                franchisees.map((franchisee) => (
                  <tr key={franchisee.id} className="hover:bg-muted/30">
                    <td className="px-5 py-4 font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{franchisee.name}</span>
                        <span className="sm:hidden text-xs text-muted-foreground">
                          {franchisee.owner?.name ?? franchisee.owner?.email ?? "Orphaned org"}
                          {franchisee.address ? ` · ${franchisee.address}` : ""}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-5 py-4 text-muted-foreground sm:table-cell">
                      {franchisee.address ?? "—"}
                    </td>
                    <td className="hidden px-5 py-4 sm:table-cell">
                      {franchisee.owner?.name ?? franchisee.owner?.email ?? "Orphaned org"}
                    </td>
                    <td className="hidden px-5 py-4 text-muted-foreground sm:table-cell">
                      {formatDate(franchisee.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <FranchiseeActions orgId={orgId} franchisee={franchisee} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Invite tokens
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Issue, extend, or revoke invite links for future franchisees.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" />
            Token lifecycle
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center">
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground">Generate an invite token</p>
              <p className="text-sm text-muted-foreground">
                Send a token to an email address so they can join this network.
              </p>
            </div>
            <div className="flex w-full gap-2 sm:max-w-md">
              <Input
                placeholder="Email to invite"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 min-w-0 flex-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.repeat) {
                    e.preventDefault();
                    handleGenerateToken();
                  }
                }}
              />
              <Button
                onClick={handleGenerateToken}
                disabled={isPending || !email.trim()}
                className="shrink-0"
              >
                {isPending ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>

          {tokenError && (
            <div className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{tokenError}</span>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Email</th>
                  <th className="hidden px-5 py-3 text-left font-medium sm:table-cell">Token</th>
                  <th className="hidden px-5 py-3 text-left font-medium sm:table-cell">Expires</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 bg-card">
                {tokens.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <KeyRound className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">No tokens generated yet</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Use the form above to create the first invite token.
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tokens.map((token) => {
                    const expired = new Date(token.expiresAt) < new Date();
                    const used = !!token.acceptedAt;
                    return (
                      <tr key={token.id} className="hover:bg-muted/30">
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-foreground">{token.invitedEmail}</span>
                            <span className="sm:hidden text-xs text-muted-foreground">
                              {formatDate(token.expiresAt)}
                            </span>
                          </div>
                        </td>
                        <td className="hidden px-5 py-4 font-mono text-xs text-muted-foreground sm:table-cell">
                          <span className="inline-block max-w-45 truncate align-middle">
                            {token.token}
                          </span>
                        </td>
                        <td className="hidden px-5 py-4 text-muted-foreground sm:table-cell">
                          {formatDate(token.expiresAt)}
                        </td>
                        <td className="px-5 py-4">
                          {used ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Used
                            </span>
                          ) : expired ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                              <Clock3 className="h-3.5 w-3.5" />
                              Expired
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                              <KeyRound className="h-3.5 w-3.5" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {!used && <TokenActions orgId={orgId} token={token} />}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
