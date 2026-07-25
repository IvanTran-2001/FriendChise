"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, ExternalLink, Share2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type MenuSharePanelProps = {
  publicToken: string;
};

export function MenuSharePanel({
  publicToken,
}: MenuSharePanelProps) {
  const [shareUrl, setShareUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    setShareUrl(`${window.location.origin}/menu/${publicToken}`);
  }, [publicToken]);

  useEffect(() => {
    let active = true;

    async function loadQr() {
      if (!shareUrl) return;
      const nextQrDataUrl = await QRCode.toDataURL(shareUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 320,
        color: {
          dark: "#111827",
          light: "#FFFFFF",
        },
      });

      if (active) setQrDataUrl(nextQrDataUrl);
    }

    loadQr().catch(() => {
      if (active) setQrDataUrl(null);
    });

    return () => {
      active = false;
    };
  }, [shareUrl]);

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopyState("copied");
    toast.success("Share link copied.");
    window.setTimeout(() => setCopyState("idle"), 1500);
  }

  return (
    <div className="flex flex-col gap-4 px-3 py-3">
      <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Share2 className="h-4 w-4 text-muted-foreground" />
          Share menu
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Send this link or let people scan the QR code.
        </p>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
          <input
            readOnly
            value={shareUrl}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none"
            aria-label="Share link"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy} aria-label="Copy share link">
            {copyState === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {shareUrl ? (
            <Button asChild variant="outline" size="sm" className="flex-1 justify-start gap-2">
              <a href={shareUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open link
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="flex-1 justify-start gap-2" disabled>
              <ExternalLink className="h-4 w-4" />
              Open link
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1 justify-start gap-2"
            disabled={!qrDataUrl}
            asChild={!!qrDataUrl}
          >
            {qrDataUrl ? (
              <a href={qrDataUrl} download={`friendchise-menu-${publicToken}.png`}>
                <Download className="h-4 w-4" />
                Download QR
              </a>
            ) : (
              <span>
                <Download className="h-4 w-4" />
                Download QR
              </span>
            )}
          </Button>
        </div>

      </div>

      <div className="flex items-center justify-center rounded-2xl border border-border bg-white p-4 shadow-sm">
        {qrDataUrl ? (
          <Image
            src={qrDataUrl}
            alt="QR code for the public menu link"
            width={224}
            height={224}
            className="h-56 w-56 rounded-xl bg-white"
          />
        ) : (
          <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
            Generating QR code...
          </div>
        )}
      </div>
    </div>
  );
}