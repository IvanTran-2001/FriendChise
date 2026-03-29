"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  usedAt: Date | null;
  usedByOrgId: string | null;
};

// ─── Modal portal ───────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>,
    document.body,
  );
}

// ─── Popup components ─────────────────────────────────────────────────────────

function ConfirmPopup({
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="absolute right-0 top-8 z-50 w-72 rounded-md border bg-popover p-4 shadow-md">
      <p className="text-sm mb-3">{message}</p>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button size="sm" variant="destructive" onClick={onConfirm} disabled={loading}>
          {loading ? "..." : "Confirm"}
        </Button>
      </div>
    </div>
  );
}

function FranchiseeActions({
  orgId,
  franchisee,
}: {
  orgId: string;
  franchisee: Franchisee;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "delete" | "changeOwner">("menu");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const reset = () => { setOpen(false); setMode("menu"); setNewOwnerEmail(""); setError(""); };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await removeFranchisee(orgId, franchisee.id);
      if (res.ok) reset();
      else setError(res.error);
    });
  };

  const handleChangeOwner = () => {
    startTransition(async () => {
      const res = await changeFranchiseeOwner(orgId, franchisee.id, newOwnerEmail);
      if (res.ok) reset();
      else setError(res.error);
    });
  };

  return (
    <div className="relative">
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => { setOpen((v) => !v); setMode("menu"); setError(""); }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open && (
        <Modal onClose={reset}>
          <div className="w-80 rounded-md border bg-popover shadow-lg">
            {mode === "menu" && (
              <>
                <button
                  className="w-full text-left px-4 py-3 text-sm hover:bg-accent"
                  onClick={() => setMode("changeOwner")}
                >
                  Change Owner
                </button>
                <button
                  className="w-full text-left px-4 py-3 text-sm hover:bg-accent"
                  onClick={reset}
                >
                  View
                </button>
                <button
                  className="w-full text-left px-4 py-3 text-sm text-destructive hover:bg-accent"
                  onClick={() => setMode("delete")}
                >
                  Delete
                </button>
              </>
            )}

            {mode === "delete" && (
              <div className="p-4">
                <p className="text-sm mb-3">
                  Are you sure you want to remove{" "}
                  <span className="font-medium">{franchisee.name}</span> from org?
                </p>
                {error && <p className="text-xs text-destructive mb-2">{error}</p>}
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={reset} disabled={isPending}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isPending}>
                    {isPending ? "..." : "Confirm"}
                  </Button>
                </div>
              </div>
            )}

            {mode === "changeOwner" && (
              <div className="p-4">
                <p className="text-sm font-medium mb-3">Change Owner</p>
                <Input
                  placeholder="New owner email"
                  value={newOwnerEmail}
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                  className="mb-2 h-8 text-sm"
                />
                {error && <p className="text-xs text-destructive mb-2">{error}</p>}
                <div className="flex gap-2 justify-end mt-3">
                  <Button size="sm" variant="outline" onClick={reset} disabled={isPending}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleChangeOwner} disabled={isPending || !newOwnerEmail.trim()}>
                    {isPending ? "..." : "Confirm"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function TokenActions({
  orgId,
  token,
}: {
  orgId: string;
  token: Token;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "delete">("menu");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const reset = () => { setOpen(false); setMode("menu"); setError(""); };

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
    <div className="relative">
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => { setOpen((v) => !v); setMode("menu"); setError(""); }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open && (
        <Modal onClose={reset}>
          <div className="w-72 rounded-md border bg-popover shadow-lg">
            {mode === "menu" && (
              <>
                <button
                  className="w-full text-left px-4 py-3 text-sm text-destructive hover:bg-accent"
                  onClick={() => setMode("delete")}
                >
                  Delete
                </button>
                <button
                  className="w-full text-left px-4 py-3 text-sm hover:bg-accent"
                  onClick={handleExtend}
                  disabled={isPending}
                >
                  {isPending ? "..." : "Extend (+1 day)"}
                </button>
            </>
          )}

            {mode === "delete" && (
              <div className="p-4">
                <p className="text-sm mb-3">Delete this token?</p>
                {error && <p className="text-xs text-destructive mb-2">{error}</p>}
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={reset} disabled={isPending}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isPending}>
                    {isPending ? "..." : "Confirm"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
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
    setTokenError("");
    startTransition(async () => {
      const res = await generateFranchiseToken(orgId, email);
      if (res.ok) setEmail("");
      else setTokenError(res.error);
    });
  };

  return (
    <div className="space-y-8">
      {/* ── Franchisee List ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Franchisee List</h2>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Location</th>
                <th className="text-left px-4 py-2 font-medium">Owner</th>
                <th className="text-left px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {franchisees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No franchisees yet. Generate an invite token below to add one.
                  </td>
                </tr>
              ) : (
                franchisees.map((f) => (
                  <tr key={f.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{f.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{f.address ?? "—"}</td>
                    <td className="px-4 py-2">{f.owner.name ?? f.owner.email ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(f.createdAt).toLocaleDateString("en-AU")}
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
            className="max-w-xs"
            onKeyDown={(e) => e.key === "Enter" && handleGenerateToken()}
          />
          <Button onClick={handleGenerateToken} disabled={isPending || !email.trim()}>
            {isPending ? "Generating..." : "Generate Token"}
          </Button>
        </div>
        {tokenError && <p className="text-sm text-destructive mb-3">{tokenError}</p>}

        {/* Token list */}
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Token</th>
                <th className="text-left px-4 py-2 font-medium">Expires</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {tokens.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No tokens generated yet.
                  </td>
                </tr>
              ) : (
                tokens.map((t) => {
                  const expired = new Date(t.expiresAt) < new Date();
                  const used = !!t.usedAt;
                  return (
                    <tr key={t.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2">{t.invitedEmail}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground truncate max-w-[180px]">
                        {t.token}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(t.expiresAt).toLocaleDateString("en-AU")}
                      </td>
                      <td className="px-4 py-2">
                        {used ? (
                          <span className="text-xs text-muted-foreground">Used</span>
                        ) : expired ? (
                          <span className="text-xs text-destructive">Expired</span>
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
