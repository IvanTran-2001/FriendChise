"use client";

/**
 * JoinFranchisePage — client component for the franchise join flow.
 *
 * Reads `?token=` from the URL. If a token is present the form is pre-filled
 * and the token field is read-only. On submit calls `joinFranchise` server
 * action which validates the token, clones the parent org's roles/tasks/
 * timetable settings into the new franchisee org, and redirects to the new
 * org on success.
 *
 * Fields: token, org name, timezone, business hours (open/close times,
 * working days).
 */
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import type { TimezoneOption } from "@/lib/timezones";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { joinFranchise } from "@/app/actions/orgs";

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

const ALL_DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

type DayKey = (typeof ALL_DAYS)[number]["key"];

function ScheduleFields({
  timezone,
  setTimezone,
  address,
  setAddress,
  openTime,
  setOpenTime,
  closeTime,
  setCloseTime,
  days,
  setDays,
  timezones,
}: {
  timezone: string;
  setTimezone: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  openTime: string;
  setOpenTime: (v: string) => void;
  closeTime: string;
  setCloseTime: (v: string) => void;
  days: DayKey[];
  setDays: (v: DayKey[]) => void;
  timezones: TimezoneOption[];
}) {
  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-sm font-medium" htmlFor="timezone">
            Time Zone
          </label>
          <TimezoneSelect
            value={timezone}
            onChange={setTimezone}
            timezones={timezones}
            className="w-full"
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-sm font-medium" htmlFor="address">
            Location
          </label>
          <Input
            id="address"
            placeholder="e.g. 123 Main St"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-sm font-medium" htmlFor="openTime">
            Start Time
          </label>
          <Input
            id="openTime"
            type="time"
            value={openTime}
            onChange={(e) => setOpenTime(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-sm font-medium" htmlFor="closeTime">
            End Time
          </label>
          <Input
            id="closeTime"
            type="time"
            value={closeTime}
            onChange={(e) => setCloseTime(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Operating Days</span>
        <SegmentedControl
          options={ALL_DAYS.map(({ key, label }) => ({ value: key, label }))}
          value={days}
          onChange={setDays}
          multiple
          variant="pills"
        />
      </div>
    </>
  );
}

function useScheduleState() {
  const [timezone, setTimezone] = useState("Australia/Sydney");
  const [address, setAddress] = useState("");
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [days, setDays] = useState<DayKey[]>(["mon", "tue", "wed", "thu", "fri"]);
  return { timezone, setTimezone, address, setAddress, openTime, setOpenTime, closeTime, setCloseTime, days, setDays };
}

function buildSchedulePayload(s: ReturnType<typeof useScheduleState>) {
  const openMin = s.openTime ? timeToMinutes(s.openTime) : undefined;
  const closeMin = s.closeTime ? timeToMinutes(s.closeTime) : undefined;
  if (openMin !== undefined && closeMin !== undefined && closeMin <= openMin) {
    throw new Error("Close time must be after open time");
  }
  return {
    timezone: s.timezone || undefined,
    address: s.address || undefined,
    operatingDays: s.days,
    openTimeMin: openMin,
    closeTimeMin: closeMin,
  };
}

export default function JoinFranchisePage({ timezones }: { timezones: TimezoneOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") ?? "";

  const [manualToken, setManualToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const schedule = useScheduleState();

  const effectiveToken = initialToken || manualToken;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await joinFranchise({
        token: effectiveToken,
        ...buildSchedulePayload(schedule),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/orgs/${result.orgId}/timetable`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 pb-16">
      <h1 className="text-xl font-semibold mb-1">Join Franchise</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Join an existing franchise using your invite token. Your org name and
        role structure will be set up automatically.
      </p>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!initialToken && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="token">
                Invite Link / Token <span className="text-destructive">*</span>
              </label>
              <Input
                id="token"
                placeholder="Paste your invite link or token"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Tokens expire after 1 hour and can only be used once.
              </p>
            </div>
          )}

          <ScheduleFields {...schedule} timezones={timezones} />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Joining..." : "Join Franchise"}
          </Button>

          <Separator />

          <div className="text-center">
            <span className="text-sm text-muted-foreground">Starting fresh? </span>
            <Link
              href="/orgs/new"
              className="text-sm font-medium text-primary hover:underline"
            >
              Create an Organization instead
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
