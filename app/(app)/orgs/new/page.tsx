"use client";

/**
 * Create-organization page — client component.
 *
 * Controlled form that calls the `createOrg` server action. On success it
 * navigates to the new org's overview page. Open/close times are collected
 * as `<input type="time">` strings and converted to minutes-since-midnight
 * before submission.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOrg } from "@/app/actions/orgs";

/**
 * Converts an HH:MM string (from a time input) to minutes since midnight.
 * e.g. "08:30" → 510
 */
function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export default function NewOrgPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body: Record<string, unknown> = { title };
    if (openTime) body.openTimeMin = timeToMinutes(openTime);
    if (closeTime) body.closeTimeMin = timeToMinutes(closeTime);

    try {
      const result = await createOrg(body);

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
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-xl font-semibold mb-6">Create Organization</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="title">
            Name <span className="text-destructive">*</span>
          </label>
          <Input
            id="title"
            placeholder="e.g. Acme Corp"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="flex gap-4">
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-sm font-medium" htmlFor="openTime">
              Open time
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
              Close time
            </label>
            <Input
              id="closeTime"
              type="time"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Organization"}
        </Button>
      </form>
    </div>
  );
}
