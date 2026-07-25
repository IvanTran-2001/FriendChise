import {
  Building2,
  ShieldCheck,
  KeyRound,
  FlaskConical,
  LayoutDashboard,
  Smartphone,
  ArrowUpRight,
} from "lucide-react";
import { Reveal } from "@/components/marketing/scroll-reveal";

const ITEMS = [
  {
    icon: Building2,
    title: "Multi-tenancy",
    detail:
      "One codebase serves every franchisor and franchisee org, cleanly isolated.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access control",
    detail:
      "A shift worker and a franchisor see different tools, same system.",
  },
  {
    icon: KeyRound,
    title: "Authentication",
    detail: "OAuth via Google and LinkedIn, backed by NextAuth sessions.",
  },
  {
    icon: FlaskConical,
    title: "Automated testing",
    detail:
      "Unit, integration, and Playwright end-to-end tests gate every deploy.",
  },
  {
    icon: LayoutDashboard,
    title: "Admin dashboard",
    detail: "Real growth and feedback analytics, not a mock.",
  },
  {
    icon: Smartphone,
    title: "Responsive, accessible UI",
    detail: "Built for a phone on the floor as much as a desk in the office.",
  },
];

/**
 * Engineering — the section that does the actual "recruiter" work.
 *
 * No generic SaaS site has this section. Its presence is the signal that
 * this is a portfolio-grade engineering artifact, without ever asking for a
 * job directly.
 */
export function EngineeringSection() {
  return (
    <section id="engineering" className="border-y border-border/60 bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-20 lg:px-6 lg:py-24">
        <Reveal className="text-center">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
            For the technically curious
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            Built like production software, because it is one.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            FriendChise runs multi-tenant, role-based access control, OAuth
            authentication, and an automated test suite — the same
            architecture patterns used at companies that run real
            infrastructure.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((item, i) => (
            <Reveal key={item.title} delayMs={i * 60}>
              <div className="flex h-full flex-col gap-2 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <item.icon className="h-5 w-5 text-primary" />
                <p className="font-mono text-sm font-medium text-foreground">
                  {item.title}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium">
          <a
            href="/doc"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:text-primary/80"
          >
            Read the architecture docs
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://github.com/IvanTran-2001/FriendChise"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:text-primary/80"
          >
            View source on GitHub
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
