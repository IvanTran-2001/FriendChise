import Link from "next/link";
import { Logo } from "@/components/layout/global/logo";
import { Button } from "@/components/ui/button";
import { NavAnchorLink } from "@/components/marketing/nav-anchor-link";

/**
 * Marketing homepage top nav — server component. The in-page section links
 * are handled by the small `NavAnchorLink` client component (smooth-scroll,
 * no URL hash); Docs and GitHub both open in a new tab so exploring either
 * never disrupts this page's scroll position or history.
 */
export function MarketingNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="shrink-0" />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            FriendChise
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <NavAnchorLink
            targetId="product"
            className="transition-colors hover:text-foreground"
          >
            Product
          </NavAnchorLink>
          <NavAnchorLink
            targetId="engineering"
            className="transition-colors hover:text-foreground"
          >
            Engineering
          </NavAnchorLink>
          <a
            href="/doc"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Docs
          </a>
          <a
            href="https://github.com/IvanTran-2001/FriendChise"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>

        <Button asChild size="sm" variant="outline">
          <Link href="/signin">Sign in</Link>
        </Button>
      </div>
    </header>
  );
}
