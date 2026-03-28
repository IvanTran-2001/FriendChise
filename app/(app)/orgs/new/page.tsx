"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { createOrg, joinFranchise } from "@/app/actions/orgs";

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
}) {
  function toggleDay(day: DayKey) {
    setDays(
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
    );
  }

  return (
    <>
      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-sm font-medium" htmlFor="timezone">
            Time Zone
          </label>
          <TimezoneSelect
            value={timezone}
            onChange={setTimezone}
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

      <div className="flex gap-3">
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
        <div className="flex gap-2 flex-wrap">
          {ALL_DAYS.map(({ key, label }) => {
            const active = days.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleDay(key)}
                className={[
                  "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
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
  return {
    timezone: s.timezone || undefined,
    address: s.address || undefined,
    operatingDays: s.days,
    openTimeMin: s.openTime ? timeToMinutes(s.openTime) : undefined,
    closeTimeMin: s.closeTime ? timeToMinutes(s.closeTime) : undefined,
  };
}

// ─── Create Org Form ────────────────────────────────────────────────────────

function CreateOrgForm({ onSwitch }: { onSwitch: () => void }) {
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
      const result = await createOrg({
        title,
        ...buildSchedulePayload(schedule),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/orgs/${result.orgId}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
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

      <ScheduleFields {...schedule} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create Organization"}
      </Button>

      <Separator />

      <div className="text-center">
        <span className="text-sm text-muted-foreground">
          Have an invite token?{" "}
        </span>
        <button
          type="button"
          onClick={onSwitch}
          className="text-sm font-medium text-primary hover:underline"
        >
          Join a Franchise instead
        </button>
      </div>
    </form>
  );
}

// ─── Join Franchise Form ─────────────────────────────────────────────────────

function JoinFranchiseForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const schedule = useScheduleState();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await joinFranchise({
        token,
        ...buildSchedulePayload(schedule),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/orgs/${result.orgId}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="token">
          Invite Link / Token <span className="text-destructive">*</span>
        </label>
        <Input
          id="token"
          placeholder="Paste your invite link or token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Tokens expire after 1 hour and can only be used once.
        </p>
      </div>

      <ScheduleFields {...schedule} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? "Joining..." : "Join Franchise"}
      </Button>

      <Separator />

      <div className="text-center">
        <span className="text-sm text-muted-foreground">Starting fresh? </span>
        <button
          type="button"
          onClick={onSwitch}
          className="text-sm font-medium text-primary hover:underline"
        >
          Create an Organization instead
        </button>
      </div>
    </form>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NewOrgPage() {
  const [mode, setMode] = useState<"create" | "join">("create");

  return (
    <div className="max-w-md mx-auto mt-12 pb-16">
      <h1 className="text-xl font-semibold mb-1">
        {mode === "create" ? "Create Organization" : "Join Franchise"}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {mode === "create"
          ? "Set up a new standalone or parent organization."
          : "Join an existing franchise using your invite token. Your org name and role structure will be set up automatically."}
      </p>

      {mode === "create" ? (
        <CreateOrgForm onSwitch={() => setMode("join")} />
      ) : (
        <JoinFranchiseForm onSwitch={() => setMode("create")} />
      )}
    </div>
  );
}
