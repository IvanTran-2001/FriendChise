import { auth } from "@/auth";
import { requireUserPage } from "@/lib/authz";
import { AccountSettingsClient } from "./account-settings-client";

export default async function AccountSettingsPage() {
  await requireUserPage();
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div className="max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">
        Account Settings
      </h1>
      <AccountSettingsClient
        user={{
          id: session.user.id as string,
          name: session.user.name ?? null,
          email: session.user.email as string,
        }}
      />
    </div>
  );
}
