"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { getVideoEmbed, isStoragePath } from "@/lib/markdown/markdown-media";
import { getOrgStorageReadUrl } from "@/app/actions/storage";

/**
 * Renders a markdown image. Absolute URLs (http/https/data/blob) are shown
 * as-is. Internal storage paths (`orgs/{orgId}/images/{uuid}.png`) are
 * resolved to a short-lived signed URL first, since the private bucket
 * doesn't serve files directly.
 */
export function MarkdownImage({
  src,
  alt,
  orgId,
}: {
  src?: string;
  alt?: string;
  orgId?: string;
}) {
  const needsResolve = isStoragePath(src);
  const canResolve = needsResolve && !!src && !!orgId;
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    if (!canResolve || !src || !orgId) return;
    let cancelled = false;
    getOrgStorageReadUrl(orgId, src).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setResolvedUrl(result.signedUrl);
        setFetchFailed(false);
      } else {
        setFetchFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [src, orgId, canResolve]);

  // Absolute URLs don't need async resolution — use them directly.
  const displayUrl = needsResolve ? resolvedUrl : (src ?? null);
  const failed = fetchFailed || (needsResolve && !canResolve);

  if (failed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border border-dashed rounded px-2 py-1 my-1">
        <ImageOff className="h-3.5 w-3.5" />
        Image unavailable
      </span>
    );
  }

  if (!displayUrl) {
    return (
      <span className="block w-full max-w-sm h-40 rounded bg-muted animate-pulse my-2" />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- source is a signed/external URL, not a static asset
    <img
      src={displayUrl}
      alt={alt ?? ""}
      className="max-w-full h-auto rounded my-2"
      loading="lazy"
      onError={() => setFetchFailed(true)}
    />
  );
}

/**
 * Renders a markdown link. Recognized video links (YouTube, Vimeo, or a
 * direct video file) are embedded as a responsive player; everything else
 * renders as a normal link.
 */
export function MarkdownLink({
  href,
  children,
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  const embed = getVideoEmbed(href);

  if (embed?.kind === "youtube" || embed?.kind === "vimeo") {
    return (
      <span className="block my-2 max-w-xl">
        <span className="relative block w-full overflow-hidden rounded" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            src={embed.embedUrl}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allowFullScreen
            title={typeof children === "string" ? children : "Embedded video"}
          />
        </span>
      </span>
    );
  }

  if (embed?.kind === "file") {
    return (
      <video
        src={embed.url}
        controls
        className="max-w-full h-auto rounded my-2"
        style={{ maxWidth: "36rem" }}
      />
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline text-primary hover:text-primary/80"
    >
      {children}
    </a>
  );
}
