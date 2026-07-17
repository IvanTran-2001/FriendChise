import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Hero } from "@/components/marketing/hero";
import { ProofStrip } from "@/components/marketing/proof-strip";
import { ProblemAndPhilosophy } from "@/components/marketing/problem-philosophy";
import { ProductDeepDive } from "@/components/marketing/product-deep-dive";
import { EngineeringSection } from "@/components/marketing/engineering-section";
import { DemoCallout } from "@/components/marketing/demo-callout";
import { Roadmap, FinalCtaFooter } from "@/components/marketing/roadmap-footer";

/**
 * Public marketing homepage, shown at `/` to anonymous visitors only
 * (authenticated users are routed to the Hub — see `app/(app)/page.tsx`).
 *
 * Section order follows the IA case study: hero → proof → problem/mission →
 * product deep-dive → engineering credibility → live demo → roadmap → footer.
 */
export function MarketingHome() {
  return (
    <div className="h-dvh w-full overflow-y-auto bg-background">
      <MarketingNav />
      <main>
        <Hero />
        <ProofStrip />
        <ProblemAndPhilosophy />
        <ProductDeepDive />
        <EngineeringSection />
        <DemoCallout />
        <Roadmap />
      </main>
      <FinalCtaFooter />
    </div>
  );
}
