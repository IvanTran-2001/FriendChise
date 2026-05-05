import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export const metadata = {
  title: "Privacy Policy — FriendChise",
};

export default function PrivacyPage() {
  return (
    <main className="h-dvh overflow-auto bg-background">
      <div className="mx-auto max-w-2xl px-6 py-16 space-y-10">
        <Link href="/">
          <Logo className="text-foreground" />
        </Link>

        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: April 23, 2026
          </p>
        </div>

        <div className="divide-y divide-border">
          <section className="py-6 space-y-2 first:pt-0">
            <h2 className="text-base font-semibold text-foreground">
              1. Information We Collect
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When you sign in to FriendChise using a third-party OAuth provider
              (Google, LinkedIn), we receive your name, email address, and
              profile picture from that provider. We store only what is
              necessary to create and manage your account.
            </p>
          </section>

          <section className="py-6 space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              2. How We Use Your Information
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your information is used solely to operate FriendChise — to
              identify your account, display your name within the application,
              and send you notifications related to your organizations and
              memberships. We do not sell or share your personal data with third
              parties.
            </p>
          </section>

          <section className="py-6 space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              3. Data Storage
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your data is stored securely in a PostgreSQL database hosted on
              Supabase. We use industry-standard practices to protect your data
              from unauthorized access.
            </p>
          </section>

          <section className="py-6 space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              4. Third-Party Services
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              FriendChise uses the following third-party services:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 pl-4">
              <li className="flex gap-2">
                <span className="text-foreground/30 select-none">—</span>
                <span>
                  <strong className="text-foreground font-medium">
                    Google OAuth
                  </strong>{" "}
                  for sign-in authentication
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-foreground/30 select-none">—</span>
                <span>
                  <strong className="text-foreground font-medium">
                    Google (lh3.googleusercontent.com)
                  </strong>{" "}
                  avatar CDN used by next/image
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-foreground/30 select-none">—</span>
                <span>
                  <strong className="text-foreground font-medium">
                    LinkedIn OAuth
                  </strong>{" "}
                  for sign-in authentication
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-foreground/30 select-none">—</span>
                <span>
                  <strong className="text-foreground font-medium">
                    Supabase
                  </strong>{" "}
                  for database hosting
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-foreground/30 select-none">—</span>
                <span>
                  <strong className="text-foreground font-medium">
                    Vercel
                  </strong>{" "}
                  for application hosting
                </span>
              </li>
            </ul>
          </section>

          <section className="py-6 space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              5. Your Rights
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You may request deletion of your account and associated data at
              any time by contacting us. Upon request, we will permanently
              remove your personal information from our systems.
            </p>
          </section>

          <section className="py-6 space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              6. Contact
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or wish to
              request deletion of your account and data, please contact us at{" "}
              <a
                href="mailto:alt28920@gmail.com"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                alt28920@gmail.com
              </a>
              . Please include your account email address and the type of
              request (privacy inquiry or data deletion) in your message for
              verification purposes.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
