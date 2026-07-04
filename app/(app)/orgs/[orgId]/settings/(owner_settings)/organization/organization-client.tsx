"use client";

import { useRef, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, ImageIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { ImageCropDialog } from "@/components/ui/image-crop-dialog";
import type { ImageCropConfig } from "@/components/ui/image-crop-dialog";
import type { TimezoneOption } from "@/lib/timezones";
import {
  updateOrgSettings,
  transferOrgOwnership,
  deleteOrg,
} from "@/app/actions/orgs";
import {
  getOrgLogoUploadUrl,
  saveOrgLogoPath,
  removeOrgLogo,
} from "@/app/actions/storage";

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Format minutes-since-midnight as a time input value (HH:MM). */
function minToTime(min: number | null): string {
  if (min == null) return "";
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Parse a time input value (HH:MM) back to minutes-since-midnight. */
function timeToMin(value: string): number | undefined {
  if (!value) return undefined;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
  return h * 60 + m;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransferableMember {
  id: string;
  user: { id: string; name: string | null; email: string } | null;
}

interface OrgData {
  id: string;
  name: string;
  ownerId: string | null;
  parentId: string | null;
  address: string | null;
  timezone: string;
  openTimeMin: number | null;
  closeTimeMin: number | null;
  image: string | null;
}

interface Props {
  org: OrgData;
  isParentOwner: boolean;
  transferableMembers: TransferableMember[];
  timezones: TimezoneOption[];
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const PUBLIC_BUCKET = "friendchise-public";

function storagePathToUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`;
}

// ─── Org Logo Panel ───────────────────────────────────────────────────────────

const LOGO_CROP_CONFIG: ImageCropConfig = {
  aspect: 1,
  outputWidth: 512,
  outputHeight: 512,
};

function OrgLogoPanel({
  orgId,
  initialPath,
}: {
  orgId: string;
  initialPath: string | null;
}) {
  const [storagePath, setStoragePath] = useState<string | null>(initialPath);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const logoUrl = storagePath ? storagePathToUrl(storagePath) : null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError(null);

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Only JPEG, PNG, and WebP images are supported.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5 MB.");
      return;
    }
    setPendingFile(file);
  }

  function handleCrop(croppedFile: File) {
    setPendingFile(null);
    setError(null);
    startTransition(async () => {
      try {
        const urlResult = await getOrgLogoUploadUrl(orgId, croppedFile.type);
        if (!urlResult.ok) {
          setError(urlResult.error);
          return;
        }

        const uploadRes = await fetch(urlResult.signedUrl, {
          method: "PUT",
          body: croppedFile,
          headers: { "Content-Type": croppedFile.type },
        });
        if (!uploadRes.ok) {
          setError("Upload failed. Please try again.");
          return;
        }

        const saveResult = await saveOrgLogoPath(orgId, urlResult.path);
        if (!saveResult.ok) {
          setError(saveResult.error);
          return;
        }

        setStoragePath(urlResult.path);
      } catch {
        setError("An unexpected error occurred. Please try again.");
      }
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeOrgLogo(orgId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStoragePath(null);
    });
  }

  return (
    <>
      <ImageCropDialog
        file={pendingFile}
        config={LOGO_CROP_CONFIG}
        onCrop={handleCrop}
        onCancel={() => setPendingFile(null)}
      />

      <div className="rounded-lg border bg-card shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Organization Logo
        </h2>

        <div className="flex items-center gap-4">
          <div className="size-20 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Org logo"
                className="size-full object-cover"
              />
            ) : (
              <ImageIcon className="size-8 text-muted-foreground" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-3.5 mr-1.5" />
                {logoUrl ? "Replace" : "Upload"}
              </Button>
              {logoUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={handleRemove}
                >
                  <X className="size-3.5 mr-1.5" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, or WebP · max 5 MB · square crop
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </>
  );
}

// ─── Org Info Form ────────────────────────────────────────────────────────────

function OrgInfoForm({
  org,
  orgId,
  timezones,
}: {
  org: OrgData;
  orgId: string;
  timezones: TimezoneOption[];
}) {
  const [address, setAddress] = useState(org.address ?? "");
  const [timezone, setTimezone] = useState(org.timezone);
  const [openTime, setOpenTime] = useState(minToTime(org.openTimeMin));
  const [closeTime, setCloseTime] = useState(minToTime(org.closeTimeMin));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateOrgSettings(orgId, {
        address: address || undefined,
        timezone,
        openTimeMin: timeToMin(openTime),
        closeTimeMin: timeToMin(closeTime),
      });
      if (result.ok) {
        setSuccess(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm p-6 space-y-4">
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Location &amp; Hours
      </h2>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
          <label className="w-full sm:w-36 text-sm text-muted-foreground shrink-0">
            Location
          </label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Melbourne, AU"
            className="w-full sm:max-w-xs"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
          <label className="w-full sm:w-36 text-sm text-muted-foreground shrink-0">
            Timezone
          </label>
          <TimezoneSelect
            value={timezone}
            onChange={setTimezone}
            timezones={timezones}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
          <label className="w-full sm:w-36 text-sm text-muted-foreground shrink-0">
            Operating Hours
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              className="w-32"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="time"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              className="w-32"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">Saved.</p>}

      <Button onClick={handleSave} disabled={isPending} size="sm">
        {isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

// ─── Transfer Ownership Section ───────────────────────────────────────────────

function TransferOwnershipSection({
  orgId,
  members,
  disabled,
}: {
  orgId: string;
  members: TransferableMember[];
  disabled: boolean;
}) {
  const [newOwnerId, setNewOwnerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleTransfer() {
    if (!newOwnerId) return;
    setError(null);
    startTransition(async () => {
      const result = await transferOrgOwnership(orgId, { newOwnerId });
      // On success, the action redirects — this code only runs on error
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <fieldset
      disabled={disabled}
      className="rounded-lg border bg-card shadow-sm p-6 space-y-4 disabled:opacity-50"
    >
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Transfer Ownership
      </h2>

      {disabled && (
        <p className="text-sm text-muted-foreground">
          Only the owner of a standalone (non-franchisee) org can transfer
          ownership.
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
        <label className="text-sm text-muted-foreground shrink-0">
          Transfer to
        </label>
        <select
          value={newOwnerId}
          onChange={(e) => setNewOwnerId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm w-full sm:max-w-xs"
        >
          <option value="">Select member</option>
          {members.map((m) => (
            <option key={m.id} value={m.user?.id}>
              {m.user?.name ?? m.user?.email ?? m.user?.id}
            </option>
          ))}
        </select>
      </div>

      {newOwnerId && (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <AlertTriangle className="size-4 shrink-0" />
          <span>You will lose ownership of this org.</span>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        variant="outline"
        size="sm"
        disabled={!newOwnerId || isPending}
        onClick={handleTransfer}
      >
        {isPending ? "Transferring…" : "Transfer"}
      </Button>
    </fieldset>
  );
}

// ─── Delete Org Section ───────────────────────────────────────────────────────

function DeleteOrgSection({
  orgId,
  orgName,
  disabled,
}: {
  orgId: string;
  orgName: string;
  disabled: boolean;
}) {
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const confirmed = confirmName === orgName;

  function handleDelete() {
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteOrg(orgId, { confirmName });
      if (!result.ok) setError(result.error);
      // On success the action redirects to "/" automatically
    });
  }

  return (
    <fieldset
      disabled={disabled}
      data-testid="delete-org-section"
      className="rounded-lg border border-destructive/40 bg-destructive/5 shadow-sm p-6 space-y-4 disabled:opacity-50"
    >
      <h2 className="font-semibold text-sm text-destructive uppercase tracking-wide">
        Delete Organization
      </h2>

      {disabled ? (
        <p className="text-sm text-muted-foreground">
          Only the owner of a standalone (non-franchisee) org can delete it.
        </p>
      ) : (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>
            This will permanently delete <strong>{orgName}</strong> and all its
            data including tasks, timetables, templates, and member
            associations. This cannot be undone.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-sm text-muted-foreground">
          Type &ldquo;{orgName}&rdquo; to confirm
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={orgName}
            className="flex-1 min-w-0 sm:max-w-xs"
          />
          <Button
            variant="destructive"
            size="sm"
            disabled={!confirmed || isPending}
            onClick={handleDelete}
          >
            {isPending ? "Deleting…" : "Delete Org"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function OrgSettingsClient({
  org,
  isParentOwner,
  transferableMembers,
  timezones,
}: Props) {
  const { orgId } = useParams<{ orgId: string }>();

  return (
    <div className="space-y-6 p-6 max-w-2xl mx-auto">
      <OrgLogoPanel orgId={orgId} initialPath={org.image} />
      <OrgInfoForm org={org} orgId={orgId} timezones={timezones} />
      <TransferOwnershipSection
        orgId={orgId}
        members={transferableMembers}
        disabled={!isParentOwner}
      />
      <DeleteOrgSection
        orgId={orgId}
        orgName={org.name}
        disabled={!isParentOwner}
      />
    </div>
  );
}
