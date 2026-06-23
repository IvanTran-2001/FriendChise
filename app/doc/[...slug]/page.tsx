import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DocNavbar } from "@/app/doc/_components/doc-navbar";
import { DocCodeBlock } from "@/app/doc/_components/doc-code-block";
import { DocRightToc } from "@/app/doc/_components/doc-right-toc";
import { DocSidebarScrollFrame } from "@/app/doc/_components/doc-sidebar-scroll-frame";
import { DocSidebarTree } from "@/app/doc/_components/doc-sidebar-tree";
import {
  extractDocHeadings,
  getDocBySlug,
  getDocMarkdown,
  getDocNavItems,
  getDocNavTree,
  slugifyHeading,
} from "@/lib/docs";

type DocPageProps = {
  params: Promise<{ slug: string[] }>;
};

function nodeText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(nodeText).join("");
  }
  if (isValidElement(value)) {
    return nodeText((value.props as { children?: ReactNode }).children);
  }
  return "";
}

export async function generateMetadata({
  params,
}: DocPageProps): Promise<Metadata> {
  const slug = (await params).slug.join("/");
  const doc = await getDocBySlug(slug);

  if (!doc) {
    return {
      title: "Docs | FriendChise",
    };
  }

  return {
    title: `${doc.title} | Docs | FriendChise`,
    description: doc.description,
  };
}

export async function generateStaticParams() {
  const navItems = await getDocNavItems();
  return navItems.map((item) => ({ slug: item.slug.split("/") }));
}

export default async function DocDetailsPage({ params }: DocPageProps) {
  const slug = (await params).slug.join("/");
  const result = await getDocMarkdown(slug);

  if (!result) {
    notFound();
  }

  const { doc, markdown } = result;
  const headings = extractDocHeadings(markdown);
  const navTree = await getDocNavTree();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <DocNavbar />
      <main className="mx-auto flex w-full max-w-330 flex-1 min-h-0 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid min-h-0 flex-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_220px]">
          <aside className="min-h-0 min-w-0">
            <DocSidebarScrollFrame>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Documentation
              </p>
              <DocSidebarTree tree={navTree} activeSlug={slug} />
            </DocSidebarScrollFrame>
          </aside>

          <article className="min-h-0 min-w-0 overflow-y-auto rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm wrap-break-word sm:p-8">
            <header className="mb-6 border-b border-border/70 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                FriendChise Docs
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {doc.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {doc.description}
              </p>
            </header>

            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => {
                  const id = slugifyHeading(nodeText(children));
                  return (
                    <h2
                      id={id}
                      className="mt-10 mb-4 scroll-mt-20 border-b border-border/70 pb-2 text-2xl font-semibold tracking-tight text-foreground"
                    >
                      {children}
                    </h2>
                  );
                },
                h3: ({ children }) => {
                  const id = slugifyHeading(nodeText(children));
                  return (
                    <h3
                      id={id}
                      className="mt-8 mb-3 scroll-mt-20 text-xl font-semibold text-foreground"
                    >
                      {children}
                    </h3>
                  );
                },
                p: ({ children }) => (
                  <p className="mb-4 wrap-break-word leading-7 text-foreground/95">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-4 list-disc space-y-1 pl-5 text-foreground/95">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-4 list-decimal space-y-1 pl-5 text-foreground/95">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="wrap-break-word leading-7">{children}</li>
                ),
                a: ({ href = "", children }) => {
                  const isExternal = /^(https?:|mailto:)/i.test(href);
                  return (
                    <a
                      href={href}
                      className="wrap-break-word font-medium text-primary underline underline-offset-4"
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noreferrer" : undefined}
                    >
                      {children}
                    </a>
                  );
                },
                code: ({ children, className }) => {
                  const isBlockCode = Boolean(className);

                  if (isBlockCode) {
                    return <code className={className}>{children}</code>;
                  }

                  return (
                    <code className="break-all rounded bg-muted px-1.5 py-0.5 text-sm">
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => {
                  const codeElement = children as React.ReactElement<{
                    children?: ReactNode;
                  }>;

                  return <DocCodeBlock>{codeElement.props.children}</DocCodeBlock>;
                },
                table: ({ children }) => (
                  <div className="mb-6 overflow-x-auto">
                    <table className="w-full min-w-180 border-collapse border border-border/70 text-sm">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border/70 bg-muted/40 px-3 py-2 text-left font-semibold text-foreground">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-border/70 px-3 py-2 align-top text-foreground/95">
                    {children}
                  </td>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="mb-4 border-l-4 border-primary/50 bg-muted/30 px-4 py-2 text-foreground/90">
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="my-8 border-border/70" />,
                img: ({ src = "", alt = "" }) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={alt}
                    className="my-4 h-auto w-full rounded-lg border border-border/70"
                    loading="lazy"
                  />
                ),
              }}
            >
              {markdown}
            </ReactMarkdown>
          </article>

          <aside className="hidden min-h-0 min-w-0 xl:block">
            <div className="h-full overflow-y-auto rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                On this page
              </p>
              <DocRightToc headings={headings} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
