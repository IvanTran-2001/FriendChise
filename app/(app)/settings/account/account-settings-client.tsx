"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteUserAccountAction } from "@/app/actions/users";

interface Props {
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export function AccountSettingsClient({ user }: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const expectedMatch = user.name ?? user.email;
  const confirmed = confirmText === expectedMatch;

  function handleDelete() {
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteUserAccountAction(confirmText);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Account Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-border/70">
              <span className="text-xl font-semibold text-primary-foreground">
                {user.name?.[0]?.toUpperCase() ??
                  user.email[0]?.toUpperCase() ??
                  "?"}
              </span>
            </div>
            <div>
              <CardTitle className="text-lg">{user.name ?? "User"}</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage your account credentials and preferences.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
            <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email Address
              </p>
              <p className="text-sm font-medium truncate mt-0.5">
                {user.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Section */}
      <fieldset
        className="rounded-lg border border-destructive/40 bg-destructive/5 shadow-sm p-6 space-y-4"
        data-testid="delete-account-section"
      >
        <h2 className="font-semibold text-sm text-destructive uppercase tracking-wide">
          Delete Account
        </h2>

        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>
            This will permanently delete your account and all associated data,
            including any organizations you own. This action cannot be undone.
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted-foreground">
            Type &ldquo;{expectedMatch}&rdquo; to confirm
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expectedMatch}
              className="flex-1 min-w-0 sm:max-w-xs"
            />
            <Button
              variant="destructive"
              size="sm"
              disabled={!confirmed || isPending}
              onClick={handleDelete}
            >
              {isPending ? "Deleting…" : "Delete Account"}
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </fieldset>
    </div>
  );
}
