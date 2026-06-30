import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserPage } from "@/lib/authz";
import { AccountSettingsClient } from "./account-settings-client";

export default async function AccountSettingsPage() {
  const { userId } = await requireUserPage();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
    },
  });

  if (!user) redirect("/signin");

  return (
    <div className="max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">
        Account Settings
      </h1>
      <AccountSettingsClient
        user={{
          id: userId,
          name: user.name ?? null,
          email: user.email,
        }}
      />
    </div>
  );
}
