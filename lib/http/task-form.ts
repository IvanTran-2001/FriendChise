export function normalizePayload(body: FormData | Record<string, unknown>) {
  if (body instanceof FormData) {
    const normalized: Record<string, unknown> = {};
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

export function normalizeToolLabel(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
