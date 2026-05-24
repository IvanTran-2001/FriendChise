/**
 * Server-only Supabase Storage helpers.
 *
 * Uses the Storage REST API directly (no @supabase/supabase-js SDK) so that
 * the legacy JWT key format works without causing "Invalid Compact JWS" errors.
 *
 * Two buckets are managed:
 *
 *   friendchise-private  — task images (private; files are read via short-lived
 *                          signed URLs generated server-side per request)
 *   friendchise-public   — org logos (public; files have permanent URLs that
 *                          require no signing)
 *
 * Storage path conventions:
 *   Task images  →  orgs/{orgId}/tasks/{taskId}/{uuid}.{ext}
 *   Org logos    →  orgs/{orgId}/{uuid}.{ext}
 *
 * Both `Task.imageUrl` and `Organization.image` store the bare storage path
 * (not the full URL). URLs are resolved at display time:
 *   - Task images  → createSignedReadUrl(path)
 *   - Org logos    → getPublicUrl(path)
 *
 * Never import this file from a "use client" component.
 */

const BUCKET = "friendchise-private";
const PUBLIC_BUCKET = "friendchise-public";

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }
  return { url, key };
}

/**
 * Creates a signed URL that the browser can PUT a file to directly,
 * bypassing Vercel's 4.5 MB body limit.
 */
export async function createSignedUploadUrl(
  storagePath: string,
  maxSizeBytes?: number,
): Promise<
  { ok: true; signedUrl: string; path: string } | { ok: false; error: string }
> {
  const { url, key } = getConfig();
  const res = await fetch(
    `${url}/storage/v1/object/upload/sign/${BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        maxSizeBytes !== undefined ? { sizeInBytes: maxSizeBytes } : {},
      ),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    return { ok: false, error: `Storage error: ${body}` };
  }
  const data = (await res.json()) as Record<string, unknown>;
  // Field name varies by Supabase version: signedURL (older) or signedUrl (newer)
  const rawUrl = (data.signedURL ?? data.signedUrl ?? data.url) as
    | string
    | undefined;
  if (!rawUrl) {
    return { ok: false, error: `Storage error: unexpected response shape` };
  }
  return {
    ok: true,
    signedUrl: rawUrl.startsWith("http")
      ? rawUrl
      : `${url}/storage/v1${rawUrl}`,
    path: (data.path as string | undefined) ?? storagePath,
  };
}

/**
 * Generates a short-lived signed URL for reading a private file.
 * Returns null if the path is empty or generation fails.
 */
export async function createSignedReadUrl(
  storagePath: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { url, key } = getConfig();
  const res = await fetch(`${url}/storage/v1/object/sign/${BUCKET}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn, paths: [storagePath] }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{
    signedURL: string | null;
    error: string | null;
  }>;
  const entry = data[0];
  if (!entry?.signedURL) return null;
  return entry.signedURL.startsWith("http")
    ? entry.signedURL
    : `${url}/storage/v1${entry.signedURL}`;
}

/**
 * Deletes a file from storage. Silently ignores errors so callers
 * don't need to guard against stale paths.
 */
export async function deleteStorageFile(storagePath: string): Promise<void> {
  const { url, key } = getConfig();
  await fetch(`${url}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: [storagePath] }),
  }).catch(() => {
    /* silently ignore */
  });
}

// ─── Public bucket helpers ────────────────────────────────────────────────────

/**
 * Creates a signed upload URL for the PUBLIC bucket (friendchise-public).
 * The browser can PUT directly to this URL; files are publicly readable.
 */
export async function createSignedUploadUrlPublic(
  storagePath: string,
  maxSizeBytes?: number,
): Promise<
  { ok: true; signedUrl: string; path: string } | { ok: false; error: string }
> {
  const { url, key } = getConfig();
  const res = await fetch(
    `${url}/storage/v1/object/upload/sign/${PUBLIC_BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        maxSizeBytes !== undefined ? { sizeInBytes: maxSizeBytes } : {},
      ),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    return { ok: false, error: `Storage error: ${body}` };
  }
  const data = (await res.json()) as Record<string, unknown>;
  const rawUrl = (data.signedURL ?? data.signedUrl ?? data.url) as
    | string
    | undefined;
  if (!rawUrl) {
    return {
      ok: false,
      error: `Storage error: unexpected response: ${JSON.stringify(data)}`,
    };
  }
  return {
    ok: true,
    signedUrl: rawUrl.startsWith("http")
      ? rawUrl
      : `${url}/storage/v1${rawUrl}`,
    path: (data.path as string | undefined) ?? storagePath,
  };
}

/**
 * Returns the permanent public URL for a file in the public bucket.
 * No signing needed — the bucket is publicly readable.
 */
export function getPublicUrl(storagePath: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return `${url}/storage/v1/object/public/${PUBLIC_BUCKET}/${storagePath}`;
}

/**
 * Deletes a file from the public bucket. Silently ignores errors.
 */
export async function deletePublicFile(storagePath: string): Promise<void> {
  const { url, key } = getConfig();
  await fetch(`${url}/storage/v1/object/${PUBLIC_BUCKET}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: [storagePath] }),
  }).catch(() => {
    /* silently ignore */
  });
}
