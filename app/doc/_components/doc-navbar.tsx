import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/global/logo";

export function DocNavbar() {
  return (
    <header className="z-30 border-b border-border/60 bg-card/90 backdrop-blur-xl supports-backdrop-filter:bg-card/80">
      <div className="mx-auto flex h-14 w-full max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            asChild
            className="h-9 shrink-0 items-center rounded-full border border-border/70 bg-background/85 px-2 pl-1.25 pr-2.5 text-foreground shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-background hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
          >
            <Link
              href="/"
              aria-label="Back to the app"
              className="flex items-center gap-1.5"
            >
              <Logo />
              <span className="hidden flex-col items-start leading-none sm:flex">
                <span className="text-[13px] font-semibold tracking-tight text-foreground/90">
                  FriendChise
                </span>
                <span
                  className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  style={{ marginTop: 1 }}
                >
                  Back to app
                </span>
              </span>
            </Link>
          </Button>

          <div className="hidden h-6 w-px bg-border/70 sm:block" />

          <div className="min-w-0">
            <Link
              href="/doc/overview"
              className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80 transition hover:border-primary/20 hover:bg-background hover:text-foreground"
            >
              Docs Home
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link
            href="/doc/contributing/getting-started"
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Getting Started
          </Link>
          <Link
            href="/doc/contributing"
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Contributing
          </Link>
          <Link
            href="/doc/contributing/support"
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Support
          </Link>
        </div>
      </div>
    </header>
  );
}
