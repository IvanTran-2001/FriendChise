import { prisma } from "@/lib/platform/prisma";
import { requireSuperAdminPage } from "@/lib/authz";
import { AdminUserGrowthCard, type GrowthRecord } from "../_components/admin-user-growth-card";

export default async function AdminGrowthPage() {
  await requireSuperAdminPage();

  const [nonDemoUsers, demoSessions] = await Promise.all([
    prisma.user.findMany({
      where: { email: { not: { endsWith: "@demo.friendchise.app" } } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.demoSession.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const growthRecords: GrowthRecord[] = [
    ...nonDemoUsers.map((user) => ({
      createdAt: user.createdAt.toISOString(),
      isDemo: false,
    })),
    ...demoSessions.map((session) => ({
      createdAt: session.createdAt.toISOString(),
      isDemo: true,
    })),
  ].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return (
    <div className="space-y-6">
      <AdminUserGrowthCard records={growthRecords} />
    </div>
  );
}