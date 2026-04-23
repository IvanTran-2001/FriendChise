import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export const metadata = {
  title: "Privacy Policy — FriendChise",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-2xl space-y-8">
        <Link href="/">
          <Logo className="text-foreground" />
        </Link>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: April 23, 2026
          </p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground">
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">1. Information We Collect</h2>
            <p className="text-muted-foreground">
              When you sign in to FriendChise using a third-party OAuth provider
              (Google, LinkedIn), we receive your name, email address, and
              profile picture from that provider. We store only what is
              necessary to create and manage your account.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">2. How We Use Your Information</h2>
            <p className="text-muted-foreground">
              Your information is used solely to operate FriendChise — to
              identify your account, display your name within the application,
              and send you notifications related to your organizations and
              memberships. We do not sell or share your personal data with third
              parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">3. Data Storage</h2>
            <p className="text-muted-foreground">
              Your data is stored securely in a PostgreSQL database hosted on
              Supabase. We use industry-standard practices to protect your data
              from unauthorized access.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">4. Third-Party Services</h2>
            <p className="text-muted-foreground">
              FriendChise uses the following third-party services:
            </p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>
                <strong className="text-foreground">Google OAuth</strong> — for
                sign-in authentication
              </li>
              <li>
                <strong className="text-foreground">Google (lh3.googleusercontent.com)</strong> — avatar CDN used by next/image
              </li>
              <li>
                <strong className="text-foreground">LinkedIn OAuth</strong> —
                for sign-in authentication
              </li>
              <li>
                <strong className="text-foreground">Supabase</strong> — for
                database hosting
              </li>
              <li>
                <strong className="text-foreground">Vercel</strong> — for
                application hosting
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">5. Your Rights</h2>
            <p className="text-muted-foreground">
              You may request deletion of your account and associated data at
              any time by contacting us. Upon request, we will permanently
              remove your personal information from our systems.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">6. Contact</h2>
            <p className="text-muted-foreground">
              If you have any questions about this Privacy Policy or wish to
              request deletion of your account and data, please contact us at{" "}
              <strong className="text-foreground">privacy@yourdomain.com</strong>.
              Please include your account email address and the type of request
              (privacy inquiry or data deletion) in your message for verification
              purposes.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}