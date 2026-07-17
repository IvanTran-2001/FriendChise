import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Logo } from "@/components/layout/global/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SignInToast } from "./sign-in-toast";
import { startDemoSessionAction } from "@/app/actions/demo";
import { TryDemoButton } from "./try-demo-button";
import { DevUserPicker } from "./dev-user-picker";
import { getDevUsers } from "./get-dev-users";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

type SignInPageProps = {
  searchParams?: Promise<{ callbackUrl?: string; hint?: string }>;
};

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 shrink-0${className ? ` ${className}` : ""}`}
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function LinkedInLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 shrink-0${className ? ` ${className}` : ""}`}
      fill="#0A66C2"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const PROVIDERS = [
  {
    id: "google",
    label: "Continue with Google",
    helper: "Use your workspace account.",
    Logo: GoogleLogo,
  },
  {
    id: "linkedin",
    label: "Continue with LinkedIn",
    helper: "Best for company profile access.",
    Logo: LinkedInLogo,
  },
] as const;

/**
 * Sign-in page — server component.
 *
 * Redirects already-authenticated users to `/` immediately.
 * Validates `callbackUrl` to only allow same-origin relative paths, preventing
 * open-redirect attacks from crafted query strings.
 * Renders OAuth sign-in buttons for all configured providers.
 */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  if (session?.user) redirect("/");
  const params = (await searchParams) ?? {};
  const hint = params.hint;
  const callbackUrl =
    params.callbackUrl?.startsWith("/") && !params.callbackUrl.startsWith("//")
      ? params.callbackUrl
      : "/";

  return (
    <div className="relative h-dvh w-full overflow-y-auto overflow-x-hidden bg-linear-to-br from-sky-500/10 via-background to-emerald-500/10">
      <div className="relative min-h-full w-full">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <SignInToast hint={hint} />

        <div className="relative z-10 mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-8 sm:py-12">
          <Link
            href="/"
            className="mx-auto mb-8 flex w-fit items-center gap-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:mb-10"
          >
            <Logo className="shrink-0" />
            <span className="font-semibold text-foreground">FriendChise</span>
          </Link>

          <div className="flex flex-1 flex-col justify-center gap-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Production access
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Sign in to FriendChise
              </h1>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
                Use your work account, or launch a seeded demo session — no
                account needed.
              </p>
            </div>

            <Card className="rounded-3xl border-border/70 bg-card/95 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm">
              <CardContent className="space-y-5 pt-6">
                <div className="space-y-3">
                  {PROVIDERS.map(({ id, label, helper, Logo }) => (
                    <form
                      key={id}
                      action={async () => {
                        "use server";
                        await signIn(id, { redirectTo: callbackUrl });
                      }}
                    >
                      <Button
                        type="submit"
                        variant="outline"
                        className="h-12 w-full justify-between rounded-2xl border-border/70 bg-background/85 px-4 shadow-sm hover:-translate-y-0.5 hover:border-primary/20 hover:bg-background"
                      >
                        <span className="flex min-w-0 items-center gap-3 text-left">
                          <Logo className="shrink-0" />
                          <span className="flex min-w-0 flex-col items-start leading-tight">
                            <span className="truncate font-medium text-foreground">
                              {label}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {helper}
                            </span>
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover/button:translate-x-0.5" />
                      </Button>
                    </form>
                  ))}
                </div>

                <div className="relative flex items-center py-1">
                  <span className="flex-1 border-t border-border/60" />
                  <span className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    or
                  </span>
                  <span className="flex-1 border-t border-border/60" />
                </div>

                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Try the demo
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        No account needed. Explore a live-style workflow in an
                        isolated demo org that resets between runs.
                      </p>

                      <form
                        className="mt-4"
                        action={async () => {
                          "use server";
                          await startDemoSessionAction("/");
                        }}
                      >
                        <TryDemoButton />
                      </form>
                    </div>
                  </div>
                </div>

                <p className="text-center text-xs leading-5 text-muted-foreground">
                  By signing in, you agree to our{" "}
                  <Link
                    href="/privacy"
                    className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          </div>

          <footer className="mt-10 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
            <p className="max-w-sm leading-5">
              FriendChise turns good work into shared standards across every
              location.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <a
                href="/doc"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
              >
                Docs
              </a>
              <span>Demo sessions reset automatically.</span>
            </div>
          </footer>
        </div>

        {process.env.NODE_ENV === "development" && (
          <DevUserPicker callbackUrl={callbackUrl} users={getDevUsers()} />
        )}
      </div>
    </div>
  );
}
