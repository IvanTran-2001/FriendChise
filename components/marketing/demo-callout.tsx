import { Sparkles } from "lucide-react";
import { Reveal } from "@/components/marketing/scroll-reveal";
import { MediaLoop } from "@/components/marketing/media-loop";
import { DemoSubmitButton } from "@/components/marketing/demo-submit-button";
import { startDemoSessionAction } from "@/app/actions/demo";

/**
 * Live demo callout — removes friction to "seeing it" for anyone who
 * doesn't want to read further. No signup, resets automatically.
 */
export function DemoCallout() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-20 text-center lg:px-6 lg:py-24">
      <Reveal>
        <Sparkles className="mx-auto h-6 w-6 text-primary" />
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          Don&apos;t take our word for it.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-base leading-7 text-muted-foreground">
          Launch a live-style demo in an isolated org. No account, no setup —
          it resets automatically when you&apos;re done.
        </p>

        <div className="mx-auto mt-8 max-w-lg">
          <MediaLoop
            gifSrc="/docs/demo.gif"
            posterSrc="/docs/timetable.png"
            alt="The guided interactive demo tour walking through FriendChise"
          />
        </div>

        <form
          className="mt-8"
          action={async () => {
            "use server";
            await startDemoSessionAction("/");
          }}
        >
          <DemoSubmitButton size="lg" className="h-11 px-6 text-[0.95rem]">
            Launch the demo
          </DemoSubmitButton>
        </form>
      </Reveal>
    </section>
  );
}
