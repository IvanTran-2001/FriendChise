import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoSubmitButton } from "@/components/marketing/demo-submit-button";
import { startDemoSessionAction } from "@/app/actions/demo";

/**
 * Hero — the 15-second test.
 *
 * Names the category + problem in one headline, proves it's a real deployed
 * product via the eyebrow, and shows the actual product UI (static
 * screenshot, not a GIF — motion is earned later once the visitor is
 * already engaged).
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 pt-16 pb-10 text-center lg:px-6 lg:pt-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Live in production &middot; used every shift, not just demoed
        </div>

        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl">
          The operations system for franchises that refuse to lose what
          works.
        </h1>

        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Tasks, training, scheduling, and tools &mdash; unified into one
          system, so your best location&apos;s habits become every
          location&apos;s habits.
        </p>

        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
          <form action={async () => { "use server"; await startDemoSessionAction("/"); }}>
            <DemoSubmitButton size="lg" className="h-11 px-5 text-[0.95rem]">
              Watch the guided demo
              <ArrowRight className="h-4 w-4" />
            </DemoSubmitButton>
          </form>
          <Button asChild variant="outline" size="lg" className="h-11 px-5 text-[0.95rem]">
            <Link href="/signin">Sign in</Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-16 lg:px-6 lg:pb-24">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_30px_90px_rgba(15,23,42,0.14)]">
          <Image
            src="/docs/timetable.png"
            alt="FriendChise interactive timetable showing a staff schedule"
            width={1600}
            height={1000}
            priority
            className="h-auto w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}
