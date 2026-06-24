import { prisma } from "@/lib/prisma";
import { requireSuperAdminPage } from "@/lib/authz";
import { AdminUserGrowthCard, type GrowthRecord } from "../_components/admin-user-growth-card";

export default async function AdminGrowthPage() {
  await requireSuperAdminPage();

  // Server-side aggregation: Fetch only timestamps and perform filtering in the database
  // Use raw SQL to get pre-filtered data efficiently instead of fetching all records
  const [nonDemoUsers, demoSessions] = await Promise.all([
    // Filter out demo emails server-side using SQL pattern matching
    // isDemoEmail checks for emails ending with @demo.friendchise.app
    prisma.$queryRaw<{ createdAt: Date }[]>`
      SELECT "createdAt"
      FROM "User"
      WHERE "email" NOT LIKE '%@demo.friendchise.app'
      ORDER BY "createdAt" ASC
    `,
    // Fetch only timestamps for demo sessions
    prisma.$queryRaw<{ createdAt: Date }[]>`
      SELECT "createdAt"
      FROM "DemoSession"
      ORDER BY "createdAt" ASC
    `,
  ]);

  // Combine pre-filtered results into growth records
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