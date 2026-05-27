"use client";

import { useEffect, useState } from "react";

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

export function DemoTimer({ expiresAt }: { expiresAt: string }) {
  const expiry = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => expiry - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(expiry - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [expiry]);

  return (
    <span className="tabular-nums">
      {formatRemaining(remaining)}
    </span>
  );
}
