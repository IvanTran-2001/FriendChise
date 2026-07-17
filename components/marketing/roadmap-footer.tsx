import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/scroll-reveal";
import { DemoSubmitButton } from "@/components/marketing/demo-submit-button";
import { startDemoSessionAction } from "@/app/actions/demo";

const ROADMAP = [
  "Warehouse-linked stock tracking",
  "Cross-location performance benchmarking",
  "Hiring workflows",
];

/**
 * Roadmap — small and confident, framed as a prioritized backlog rather
 * than an aspirational "vision" (the tone the old homepage used, which read
 * as unfinished vaporware).
 */
export function Roadmap() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 text-center lg:px-6">
      <Reveal>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          What&apos;s next
        </h2>
        <ul className="mt-5 flex flex-col items-center gap-2 text-sm text-muted-foreground sm:flex-row sm:justify-center sm:gap-6">
          {ROADMAP.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
              {item}
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

/**
 * Final CTA + footer — closes the loop for all three audiences: recruiters
 * (GitHub), business owners (sign in), contributors (docs/GitHub).
 */
export function FinalCtaFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center lg:px-6">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            See it, use it, or read how it&apos;s built.
          </h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <form
              action={async () => {
                "use server";
                await startDemoSessionAction("/");
              }}
            >
              <DemoSubmitButton size="lg" className="h-11 px-5 text-[0.95rem]">
                Launch demo
              </DemoSubmitButton>
            </form>
            <Button asChild variant="outline" size="lg" className="h-11 px-5 text-[0.95rem]">
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-11 px-5 text-[0.95rem]">
              <a
                href="https://github.com/IvanTran-2001/FriendChise"
                target="_blank"
                rel="noreferrer"
              >
                View on GitHub
              </a>
            </Button>
          </div>
        </Reveal>

        <div className="mt-14 flex flex-col items-center gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>Demo sessions reset automatically.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <a
              href="/doc"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              Docs
            </a>
            <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
              Privacy Policy
            </Link>
            <a
              href="https://github.com/IvanTran-2001/FriendChise"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/company/friendchise-app/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
