import { prisma } from "@/lib/prisma";
import { isDemoEmail } from "@/lib/demo";
import { requireSuperAdminPage } from "@/lib/authz";
import { AdminUserGrowthCard, type UserGrowthRecord } from "../_components/admin-user-growth-card";

export default async function AdminGrowthPage() {
  await requireSuperAdminPage();

  const users = await prisma.user.findMany({
    select: {
      createdAt: true,
      email: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const userGrowthRecords: UserGrowthRecord[] = users.map((user) => ({
    createdAt: user.createdAt.toISOString(),
    isDemo: isDemoEmail(user.email),
  }));

  return (
    <div className="space-y-6">
      <AdminUserGrowthCard records={userGrowthRecords} />
    </div>
  );
}