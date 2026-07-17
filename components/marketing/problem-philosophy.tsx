import Link from "next/link";
import { Reveal } from "@/components/marketing/scroll-reveal";

/**
 * Problem — earns the "why" before the "what".
 * Philosophy — the emotional payoff, one line, given room to breathe.
 *
 * Kept as a single section so the page reaches the first product screenshot
 * quickly; each half stays deliberately short.
 */
export function ProblemAndPhilosophy() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center lg:px-6 lg:py-28">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          When your best employee leaves, does their knowledge leave too?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          Most franchises run on tribal knowledge — the way one manager tapes
          up a closing checklist, the recipe tweak nobody wrote down, the
          schedule pattern only one person remembers. It works, until that
          person is on holiday, or gone.
        </p>
        <Link
          href="/doc/overview/problem-space"
          className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
        >
          Read the full problem space →
        </Link>
      </Reveal>

      <Reveal delayMs={150} className="mt-20 border-t border-border/60 pt-16">
        <p className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
          Helping every location operate like its best one.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          That&apos;s the whole product, in one sentence.
        </p>
      </Reveal>
    </section>
  );
}
