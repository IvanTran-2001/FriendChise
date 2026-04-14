import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Logo } from "@/components/layout/logo";
import { SignInToast } from "./sign-in-toast";

type SignInPageProps = {
  searchParams?: Promise<{ callbackUrl?: string; hint?: string }>;
};

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
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

const PROVIDERS = [
  { id: "google", label: "Continue with Google", Logo: GoogleLogo },
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
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-background gap-6">
      <SignInToast hint={hint} />
      <Logo className="text-foreground" />
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Sign in</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in to access your organizations.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          {PROVIDERS.map(({ id, label, Logo }) => (
            <form
              key={id}
              action={async () => {
                "use server";
                await signIn(id, { redirectTo: callbackUrl });
              }}
            >
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Logo />
                {label}
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
