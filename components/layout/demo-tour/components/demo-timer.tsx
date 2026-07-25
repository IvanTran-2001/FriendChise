"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function DemoTimer({
  expiresAt,
}: {
  expiresAt: string;
}) {
  const expiry = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => expiry - Date.now());


  useEffect(() => {
    const id = setInterval(() => {
      const r = expiry - Date.now();
      setRemaining(r);
      if (r <= 0) {
        clearInterval(id);
        toast.error("Your demo session has expired.");
        setTimeout(() => signOut({ redirectTo: "/signin" }), 1500);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiry]);

  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {formatRemaining(remaining)}
    </span>
  );
}