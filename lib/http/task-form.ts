export function normalizePayload(body: FormData | Record<string, unknown>) {
  if (body instanceof FormData) {
    const normalized: Record<string, unknown> = Object.create(null);
    for (const [key, value] of body.entries()) {
      const existing = normalized[key];
      if (existing === undefined) {
        normalized[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        normalized[key] = [existing, value];
      }
    }
    return normalized;
  }

  return body;
}

export function hasField(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Returns a number when present and valid, or undefined for absent/malformed input. */
export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Returns a number, null for an intentional clear, or undefined for malformed input. */
export function asNullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.every((entry) => typeof entry === "string") ? value : undefined;
  }

  if (typeof value === "string") {
    return [value];
  }

  return undefined;
}

export function asNullableStringArray(value: unknown): (string | null)[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.every((entry) => typeof entry === "string" || entry === null) ? value : undefined;
}

export function normalizeToolLabel(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
