import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { LOGO_ALT_TEXT, TAB_LOGO_FILE_NAME } from "@/lib/logo";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export const runtime = "nodejs";

/**
 * Dynamic favicon — renders the FriendChise logo mark from the shared export.
 */
export default async function Icon() {
  const filePath = path.join(process.cwd(), "public", TAB_LOGO_FILE_NAME);
  const imageBuffer = await readFile(filePath);
  const imageDataUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        border: "1.5px solid rgba(79, 125, 219, 0.25)",
        background: "#f4f8ff",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <img
        src={imageDataUrl}
        alt={LOGO_ALT_TEXT}
        width={32}
        height={32}
        style={{
          width: 32,
          height: 32,
          objectFit: "cover",
          objectPosition: "center center",
          transform: "scale(1.5)",
        }}
      >
      </img>
    </div>,
    { ...size },
  );
}
