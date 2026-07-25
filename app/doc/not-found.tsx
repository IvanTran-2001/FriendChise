import Link from "next/link";
import { DocNavbar } from "@/app/doc/_components/doc-navbar";

export default function DocNotFound() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <DocNavbar />

      <main className="mx-auto flex w-full max-w-330 flex-1 min-h-0 px-4 py-8 sm:px-6 lg:px-8">
        <section className="flex min-h-0 w-full items-center justify-center rounded-2xl border border-border/70 bg-card/90 p-8 shadow-sm">
          <div className="max-w-xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Docs
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Page not found
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
              That documentation page does not exist or was moved.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/doc/overview"
                className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Go to Docs Home
              </Link>
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-full border border-border/70 bg-background px-4 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Back to app
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
