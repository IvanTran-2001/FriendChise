import Image from "next/image";
import { cn } from "@/lib/core/utils";
import { LOGO_ALT_TEXT, LOGO_PUBLIC_SRC } from "@/lib/assets/logo";

/**
 * FriendChise logo badge — icon-only mark used across the app shell.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex select-none", className)}>
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#4f7ddb]/25 bg-[#f4f8ff] shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-[#4f7ddb]/10">
        <Image
          src={LOGO_PUBLIC_SRC}
          alt={LOGO_ALT_TEXT}
          fill
          sizes="48px"
          className="object-cover object-[center_18%] scale-[1.28]"
          priority
        />
      </span>
    </span>
  );
}
