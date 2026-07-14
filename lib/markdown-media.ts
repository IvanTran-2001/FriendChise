/**
 * Shared helpers for embedding rich media in markdown content.
 *
 * Two kinds of media are supported by the markdown editor/renderer:
 *   - Images: uploaded by the user and stored as a path in the private
 *     Supabase bucket (see lib/supabase-storage.ts). Markdown stores the
 *     bare path (`![alt](orgs/{orgId}/images/{uuid}.png)`) and it's
 *     resolved to a signed URL at render time.
 *   - Videos: link-only (no upload). A pasted/inserted link is detected as
 *     a video link and embedded as a player instead of a plain `<a>`.
 *
 * This module is safe to import from both client and server code — it has
 * no side effects and does no I/O.
 */

export type VideoEmbed =
  | { kind: "youtube"; embedUrl: string }
  | { kind: "vimeo"; embedUrl: string }
  | { kind: "file"; url: string };

/**
 * Only these hosts (and direct video file links) are ever turned into an
 * embedded player. Everything else renders as a normal link — this is what
 * keeps the renderer safe, since we never inject arbitrary iframe sources.
 */
export function getVideoEmbed(href: string | undefined | null): VideoEmbed | null {
  if (!href) return null;

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^www\./, "");

  // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID
  if (host === "youtube.com" || host === "m.youtube.com") {
    let id: string | null = null;
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/")[2];
    else if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/")[2];
    if (id && /^[\w-]{6,15}$/.test(id)) {
      return { kind: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    return null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    if (id && /^[\w-]{6,15}$/.test(id)) {
      return { kind: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    return null;
  }

  // Vimeo: vimeo.com/ID
  if (host === "vimeo.com") {
    const id = url.pathname.slice(1).split("/")[0];
    if (id && /^\d+$/.test(id)) {
      return { kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` };
    }
    return null;
  }

  // Direct video file link
  if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) {
    return { kind: "file", url: href };
  }

  return null;
}

/**
 * True for markdown image `src` values that are internal storage paths
 * (e.g. `orgs/{orgId}/images/{uuid}.png`) rather than absolute URLs.
 * These need to be resolved to a signed URL before they can be displayed.
 */
export function isStoragePath(src: string | undefined | null): boolean {
  if (!src) return false;
  return !/^(https?:|data:|blob:)/i.test(src);
}
