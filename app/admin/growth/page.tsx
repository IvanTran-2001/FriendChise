import { prisma } from "@/lib/prisma";
import { isDemoEmail } from "@/lib/demo";
import { requireSuperAdminPage } from "@/lib/authz";
import { AdminUserGrowthCard, type GrowthRecord } from "../_components/admin-user-growth-card";

export default async function AdminGrowthPage() {
  await requireSuperAdminPage();

  const [users, demoSessions] = await Promise.all([
    prisma.user.findMany({
      select: {
        createdAt: true,
        email: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.$queryRaw<{ createdAt: Date }[]>`
      SELECT "createdAt"
      FROM "DemoSession"
      ORDER BY "createdAt" ASC
    `,
  ]);

  const growthRecords: GrowthRecord[] = [
    ...users
      .filter((user) => !isDemoEmail(user.email))
      .map((user) => ({
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