import { CheckCircle2 } from "lucide-react";

const CLAIMS = [
  "Used every shift, not just demoed",
  "Every recurring task has a documented procedure",
  "Zero paper on the shift lead's clipboard",
];

/**
 * Proof strip — the credibility section.
 *
 * Kills skepticism with plain, honest claims before any feature is
 * explained. Deliberately qualitative rather than raw counts — this is a
 * single production org, not a network, so numbers like "19 users" invite
 * "so what?" instead of confidence. No CTA here on purpose.
 */
export function ProofStrip() {
  return (
    <section className="border-y border-border/60 bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        <p className="text-center text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Not a concept. In use every day.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {CLAIMS.map((claim) => (
            <div
              key={claim}
              className="flex items-center justify-center gap-2.5 rounded-xl border border-border/60 bg-card/70 px-4 py-3.5 text-center shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm font-medium text-foreground">{claim}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
