export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function hoursWorked(startMin: number | null, endMin: number | null): string {
  if (startMin === null || endMin === null) return "";
  const diff = endMin - startMin;
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function timeToMinutes(time: string): number | null {
  if (!time) return null;
  const parts = time.split(":");
  if (parts.length !== 2) return null;
  const [h, m] = parts.map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}
