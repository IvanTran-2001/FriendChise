import Link from "next/link";

export default function DocNotFound() {
  return (
    <section className="flex min-h-0 items-center justify-center rounded-2xl border border-border/70 bg-card/90 p-8 shadow-sm xl:col-span-2">
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
  );
}

