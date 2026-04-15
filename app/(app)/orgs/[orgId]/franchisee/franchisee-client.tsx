"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  generateFranchiseToken,
  deleteFranchiseToken,
  extendFranchiseToken,
  removeFranchisee,
  changeFranchiseeOwner,
} from "@/app/actions/franchisee";

// ─── Types (mirroring server page shape) ─────────────────────────────────────

type Franchisee = {
  id: string;
  name: string;
  address: string | null;
  createdAt: Date;
  owner: { id: string; name: string | null; email: string | null };
};

type Token = {
  id: string;
  token: string;
  invitedEmail: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  usedByOrgId: string | null;
};

// ─── Popup components ─────────────────────────────────────────────────────────

function FranchiseeActions({
  orgId,
  franchisee,
}: {
  orgId: string;
  franchisee: Franchisee;
}) {
  const [mode, setMode] = useState<
    "closed" | "menu" | "delete" | "changeOwner"
  >("closed");
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
      } else setError(res.error);
    });
  };

  const handleChangeOwner = () => {
    const trimmedEmail = newOwnerEmail.trim();
    if (!trimmedEmail || isPending) return;
    startTransition(async () => {
      const res = await changeFranchiseeOwner(
        orgId,
        franchisee.id,
        trimmedEmail,
      );
      if (res.ok) {
        reset();
        router.refresh();
      } else setError(res.error);
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

      {/* Menu dialog */}
      <Dialog open={mode === "menu"} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{franchisee.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1 -mx-2">
            <button
              className="w-full text-left px-4 py-2.5 text-sm rounded-md hover:bg-accent"
              onClick={() => setMode("changeOwner")}
            >
              Change Owner
            </button>
            <button
              className="w-full text-left px-4 py-2.5 text-sm text-destructive rounded-md hover:bg-accent"
              onClick={() => setMode("delete")}
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={mode === "delete"} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete franchisee</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {franchisee.name}
              </span>{" "}
              and all its data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change owner dialog */}
      <Dialog open={mode === "changeOwner"} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Owner</DialogTitle>
            <DialogDescription>
              Enter the email of the new owner for{" "}
              <span className="font-medium text-foreground">
                {franchisee.name}
              </span>
              .
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
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleChangeOwner}
              disabled={isPending || !newOwnerEmail.trim()}
            >
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

      {/* Menu dialog */}
      <Dialog open={mode === "menu"} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{token.invitedEmail}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1 -mx-2">
            <button
              className="w-full text-left px-4 py-2.5 text-sm rounded-md hover:bg-accent"
              onClick={handleExtend}
              disabled={isPending}
            >
              {isPending ? "…" : "Extend (+1 day)"}
            </button>
            <button
              className="w-full text-left px-4 py-2.5 text-sm text-destructive rounded-md hover:bg-accent"
              onClick={() => setMode("delete")}
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={mode === "delete"} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete token</DialogTitle>
            <DialogDescription>
              Delete the invite token for{" "}
              <span className="font-medium text-foreground">
                {token.invitedEmail}
              </span>
              ?
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main client component ─────────────────────────────────────────────────────

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
    <div className="space-y-8">
      {/* ── Franchisee List ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Franchisee List</h2>
        <div className="rounded-md border overflow-hidden overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="hidden sm:table-cell text-left px-4 py-2 font-medium">
                  Location
                </th>
                <th className="hidden sm:table-cell text-left px-4 py-2 font-medium">
                  Owner
                </th>
                <th className="hidden sm:table-cell text-left px-4 py-2 font-medium">
                  Created
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {franchisees.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No franchisees yet. Generate an invite token below to add
                    one.
                  </td>
                </tr>
              ) : (
                franchisees.map((f) => (
                  <tr key={f.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">
                      <div>{f.name}</div>
                      <div className="sm:hidden text-xs text-muted-foreground">
                        {f.owner.name ?? f.owner.email ?? "—"}
                        {f.address ? ` · ${f.address}` : ""}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-2 text-muted-foreground">
                      {f.address ?? "—"}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-2">
                      {f.owner.name ?? f.owner.email ?? "—"}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-2 text-muted-foreground">
                      {new Date(f.createdAt).toLocaleDateString("en-AU", {
                        timeZone: "UTC",
                      })}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <FranchiseeActions orgId={orgId} franchisee={f} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Invite Tokens ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Invite Tokens</h2>

        {/* Generate form */}
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Email to invite"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 min-w-0 h-9 text-sm"
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
          >
            {isPending ? "Generating..." : "Generate Token"}
          </Button>
        </div>
        {tokenError && (
          <p className="text-sm text-destructive mb-3">{tokenError}</p>
        )}

        {/* Token list */}
        <div className="rounded-md border overflow-hidden overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="hidden sm:table-cell text-left px-4 py-2 font-medium">
                  Token
                </th>
                <th className="hidden sm:table-cell text-left px-4 py-2 font-medium">
                  Expires
                </th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {tokens.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No tokens generated yet.
                  </td>
                </tr>
              ) : (
                tokens.map((t) => {
                  const expired = new Date(t.expiresAt) < new Date();
                  const used = !!t.acceptedAt;
                  return (
                    <tr key={t.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <div>{t.invitedEmail}</div>
                        <div className="sm:hidden text-xs text-muted-foreground">
                          {new Date(t.expiresAt).toLocaleDateString("en-AU", {
                            timeZone: "UTC",
                          })}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-2 font-mono text-xs text-muted-foreground truncate max-w-45">
                        {t.token}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-2 text-muted-foreground">
                        {new Date(t.expiresAt).toLocaleDateString("en-AU", {
                          timeZone: "UTC",
                        })}
                      </td>
                      <td className="px-4 py-2">
                        {used ? (
                          <span className="text-xs text-muted-foreground">
                            Used
                          </span>
                        ) : expired ? (
                          <span className="text-xs text-destructive">
                            Expired
                          </span>
                        ) : (
                          <span className="text-xs text-green-600">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {!used && <TokenActions orgId={orgId} token={t} />}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}