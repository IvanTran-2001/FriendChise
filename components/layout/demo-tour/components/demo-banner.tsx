/**
 * Compact demo status strip shown only for demo sessions.
 */
import { signOut, auth } from "@/auth";
import { isDemoEmail } from "@/lib/demo";
import { DemoTimer } from "./demo-timer";
import { Clock3, Sparkles, X } from "lucide-react";

type DemoBannerSession = {
  expires: string;
  user?: { email?: string | null } | null;
} | null;

export async function DemoBanner({ session: sessionProp }: { session?: DemoBannerSession }) {
  const session = sessionProp ?? (await auth());
  if (!session || !isDemoEmail(session.user?.email ?? "")) return null;

  return (
    <div
      data-demo-banner
      className="fixed inset-x-0 bottom-0 z-30 border-t border-amber-500/20 bg-linear-to-r from-amber-500/10 via-amber-500/6 to-background px-3 py-2 text-[13px] backdrop-blur-sm sm:sticky sm:top-0 sm:z-40 sm:border-b"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="flex min-h-8 items-center gap-2 sm:hidden">
        <div className="flex min-w-0 flex-1 items-center justify-start gap-2">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
          <span className="min-w-0 truncate whitespace-nowrap text-left text-amber-900/80 dark:text-amber-200/80">
            <DemoTimer expiresAt={session.expires} />
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div data-demo-tour-banner-slot-mobile className="min-w-0" />
        </div>
        <div className="flex shrink-0 items-center justify-end">
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button
              type="submit"
              className="inline-flex h-8 shrink-0 items-center rounded-full border border-amber-500/20 bg-background/80 px-3 text-xs font-semibold text-amber-900 shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:bg-background dark:text-amber-200"
              aria-label="End demo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>

      <div className="hidden min-h-8 items-center justify-between gap-3 sm:flex">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 truncate whitespace-nowrap text-amber-900 dark:text-amber-200">
            <span className="font-semibold">Demo session</span>
            <span className="mx-2 text-amber-900/60 dark:text-amber-200/60">•</span>
            <span className="text-amber-900/80 dark:text-amber-200/80">
              Ends in <DemoTimer expiresAt={session.expires} />
            </span>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div data-demo-tour-banner-slot-desktop className="flex shrink-0 items-center" />
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button
              type="submit"
              className="inline-flex h-8 shrink-0 items-center rounded-full border border-amber-500/20 bg-background/80 px-3 text-xs font-semibold text-amber-900 shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:bg-background dark:text-amber-200"
              aria-label="End demo"
            >
              End demo
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}