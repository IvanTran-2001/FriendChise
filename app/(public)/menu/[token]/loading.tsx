import { Skeleton } from "@/components/ui/skeleton";

export default function PublicMenuLoading() {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-stone-100">
      <header className="sticky top-0 z-30 border-b border-stone-800 bg-stone-950 shadow-lg">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl bg-stone-800" />

          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 rounded-md bg-stone-800" />
            <Skeleton className="h-3 w-24 rounded-md bg-stone-800" />
          </div>

          <Skeleton className="h-8 w-24 shrink-0 rounded-full bg-stone-800" />
        </div>
      </header>

      <div className="sticky top-16 z-20 border-b border-stone-200 bg-white shadow-sm">
        <div
          className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-2.5 sm:px-6 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-9 shrink-0 rounded-full bg-stone-200"
              style={{ width: `${index === 0 ? 58 : 72 + (index % 3) * 18}px` }}
            />
          ))}
        </div>
      </div>

      <div className="mx-auto min-h-0 flex-1 w-full max-w-5xl space-y-10 overflow-hidden px-4 pb-28 pt-6 sm:px-6 sm:pb-32 sm:pt-6">
        <section className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 rounded-md bg-stone-200" />
            <Skeleton className="h-4 w-72 rounded-md bg-stone-200" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <article
                key={index}
                className="flex min-h-22 flex-col rounded-2xl border border-stone-200 bg-white px-2.5 py-2 shadow-sm"
              >
                <div className="flex items-start justify-between gap-1">
                  <Skeleton className="h-4 flex-1 rounded-md bg-stone-200" />
                  <Skeleton className="h-5 w-14 shrink-0 rounded-full bg-stone-200" />
                </div>

                <Skeleton className="mt-1 h-3.5 w-full rounded-md bg-stone-200" />
                <Skeleton className="mt-1 h-3 w-5/6 rounded-md bg-stone-200" />

                <div className="mt-auto pt-1">
                  <Skeleton className="h-3 w-3/5 rounded-md bg-stone-200" />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40 rounded-md bg-stone-200" />
            <Skeleton className="h-4 w-64 rounded-md bg-stone-200" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <article
                key={index}
                className="flex min-h-22 flex-col rounded-2xl border border-stone-200 bg-white px-2.5 py-2 shadow-sm"
              >
                <div className="flex items-start justify-between gap-1">
                  <Skeleton className="h-4 flex-1 rounded-md bg-stone-200" />
                  <Skeleton className="h-5 w-14 shrink-0 rounded-full bg-stone-200" />
                </div>

                <Skeleton className="mt-1 h-3.5 w-full rounded-md bg-stone-200" />
                <Skeleton className="mt-1 h-3 w-4/5 rounded-md bg-stone-200" />

                <div className="mt-auto pt-1">
                  <Skeleton className="h-3 w-2/3 rounded-md bg-stone-200" />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-5xl justify-center">
          <Skeleton className="h-4 w-48 rounded-md bg-stone-200" />
        </div>
      </footer>
    </div>
  );
}