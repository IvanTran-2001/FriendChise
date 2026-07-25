import { Reveal } from "@/components/marketing/scroll-reveal";
import { MediaLoop } from "@/components/marketing/media-loop";
import Image from "next/image";
import { cn } from "@/lib/core/utils";

function Row({
  eyebrow,
  headline,
  copy,
  media,
  reverse,
}: {
  eyebrow: string;
  headline: string;
  copy: string;
  media: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <Reveal className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:gap-14 lg:py-20">
      <div className={cn(reverse && "lg:order-2")}>
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          {eyebrow}
        </p>
        <h3 className="mt-3 max-w-md text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          {headline}
        </h3>
        <p className="mt-3 max-w-md text-base leading-7 text-muted-foreground">
          {copy}
        </p>
      </div>
      <div className={cn(reverse && "lg:order-1")}>{media}</div>
    </Reveal>
  );
}

/**
 * Product deep-dive — the actual demonstration of the product.
 *
 * Four rows deliberately vary in layout rhythm (image-right, image-left,
 * full-bleed overlay, 2-up split) so the section doesn't read as four
 * identical template blocks in a row.
 */
export function ProductDeepDive() {
  return (
    <section id="product" className="mx-auto max-w-5xl px-4 lg:px-6">
      <Row
        eyebrow="Task management"
        headline="One task, taught once, done the same way everywhere."
        copy="Tasks carry instructions, media, and comments — so training travels with the work instead of living in someone's memory."
        media={
          <MediaLoop
            gifSrc="/docs/task.gif"
            posterSrc="/docs/task.png"
            alt="Creating and completing a task in FriendChise"
          />
        }
      />

      <Row
        reverse
        eyebrow="Timetable & roster"
        headline="Scheduling that understands your team, not just your grid."
        copy="Build a roster once, reuse it as a template, and let the timetable assign shifts automatically instead of rebuilding the same week by hand."
        media={
          <MediaLoop
            gifSrc="/docs/timetable.gif"
            posterSrc="/docs/timetable.png"
            alt="Building a weekly roster and timetable in FriendChise"
          />
        }
      />

      {/* Full-bleed break in rhythm — knowledge base is about structure and
          readability, not motion, so it gets a static screenshot with an
          overlaid text card instead of another two-column row. */}
      <Reveal className="relative my-6 overflow-hidden rounded-3xl border border-border/70 shadow-[0_30px_90px_rgba(15,23,42,0.14)]">
        <Image
          src="/docs/hub.png"
          alt="FriendChise knowledge base and procedures library"
          width={1600}
          height={1000}
          className="h-auto w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-background/95 via-background/60 to-transparent p-6 sm:p-10">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
            Knowledge base &amp; procedures
          </p>
          <h3 className="mt-2 max-w-md text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            Every &ldquo;how we do it here&rdquo; answer, in one place.
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
            Procedures replace the laminated sheet taped to the wall —
            searchable, versioned, and the same for every location.
          </p>
        </div>
      </Reveal>

      {/* 2-up split — tools and QR menu are both "floor" tools, shown
          side by side rather than as another full-width row. */}
      <Reveal className="py-14 lg:py-20">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          Business tools &amp; QR menu
        </p>
        <h3 className="mt-3 max-w-lg text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          The floor tools staff actually reach for.
        </h3>
        <p className="mt-3 max-w-lg text-base leading-7 text-muted-foreground">
          Operational calculators for the shift lead, and a QR menu customers
          scan directly — real workflows, not a demo feature.
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <MediaLoop
            gifSrc="/docs/tools.gif"
            posterSrc="/docs/tools.png"
            alt="Using an operational calculator tool in FriendChise"
          />
          <MediaLoop
            gifSrc="/docs/menu.gif"
            posterSrc="/docs/menu.png"
            alt="Customer scanning a FriendChise QR menu"
          />
        </div>
      </Reveal>
    </section>
  );
}
