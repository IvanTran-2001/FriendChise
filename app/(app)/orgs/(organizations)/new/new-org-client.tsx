"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import type { TimezoneOption } from "@/lib/timezones";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { createOrg } from "@/app/actions/orgs";

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

/** Shared schedule fields used by both Create and Join forms */
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
            id="timezone"
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
  const [days, setDays] = useState<DayKey[]>([
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
  ]);
  return {
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
  };
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

// ─── Create Org Form ────────────────────────────────────────────────────────

export default function NewOrgPage({
  timezones,
}: {
  timezones: TimezoneOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const schedule = useScheduleState();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        setError("Organization name is required");
        setLoading(false);
        return;
      }
      const result = await createOrg({
        title: trimmedTitle,
        ...buildSchedulePayload(schedule),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/orgs/${result.orgId}/timetable`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 pb-16">
      <h1 className="text-xl font-semibold mb-1">Create Organization</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Set up a new standalone or parent organization.
      </p>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="title">
              Org Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="title"
              placeholder="e.g. Acme Corp"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <ScheduleFields {...schedule} timezones={timezones} />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Organization"}
          </Button>

          <Separator />

          <div className="text-center">
            <span className="text-sm text-muted-foreground">
              Have an invite token?{" "}
            </span>
            <Link
              href="/orgs/join"
              className="text-sm font-medium text-primary hover:underline"
            >
              Join a Franchise instead
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
