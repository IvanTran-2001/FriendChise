import type { SeedPlan } from "./seed-plan";

export async function seedUsers(prisma: import("@prisma/client").PrismaClient) {
  const [owner, jordan, casey, riley, morgan, alex, taylor, sam, quinn] =
    await Promise.all([
      prisma.user.upsert({
        where: { email: "owner@example.test" },
        update: { name: "MainDev", image: "https://i.pravatar.cc/150?img=3" },
        create: {
          email: "owner@example.test",
          name: "MainDev",
          image: "https://i.pravatar.cc/150?img=3",
        },
      }),
      prisma.user.upsert({
        where: { email: "jordan@example.test" },
        update: { name: "Jordan", image: "https://i.pravatar.cc/150?img=8" },
        create: {
          email: "jordan@example.test",
          name: "Jordan",
          image: "https://i.pravatar.cc/150?img=8",
        },
      }),
      prisma.user.upsert({
        where: { email: "casey@example.test" },
        update: { name: "Casey", image: "https://i.pravatar.cc/150?img=12" },
        create: {
          email: "casey@example.test",
          name: "Casey",
          image: "https://i.pravatar.cc/150?img=12",
        },
      }),
      prisma.user.upsert({
        where: {
          email: process.env.E2E_TEST_USER_EMAIL ?? "ivan@example.test",
        },
        update: { name: "Riley", image: "https://i.pravatar.cc/150?img=5" },
        create: {
          email: process.env.E2E_TEST_USER_EMAIL ?? "ivan@example.test",
          name: "Riley",
          image: "https://i.pravatar.cc/150?img=5",
        },
      }),
      prisma.user.upsert({
        where: { email: "morgan@example.test" },
        update: { name: "Morgan", image: "https://i.pravatar.cc/150?img=22" },
        create: {
          email: "morgan@example.test",
          name: "Morgan",
          image: "https://i.pravatar.cc/150?img=22",
        },
      }),
      prisma.user.upsert({
        where: { email: "alex@example.test" },
        update: { name: "Alex", image: "https://i.pravatar.cc/150?img=15" },
        create: {
          email: "alex@example.test",
          name: "Alex",
          image: "https://i.pravatar.cc/150?img=15",
        },
      }),
      prisma.user.upsert({
        where: { email: "taylor@example.test" },
        update: { name: "Taylor", image: "https://i.pravatar.cc/150?img=29" },
        create: {
          email: "taylor@example.test",
          name: "Taylor",
          image: "https://i.pravatar.cc/150?img=29",
        },
      }),
      prisma.user.upsert({
        where: { email: "sam@example.test" },
        update: { name: "Sam", image: "https://i.pravatar.cc/150?img=35" },
        create: {
          email: "sam@example.test",
          name: "Sam",
          image: "https://i.pravatar.cc/150?img=35",
        },
      }),
      prisma.user.upsert({
        where: { email: "quinn@example.test" },
        update: { name: "Quinn", image: "https://i.pravatar.cc/150?img=44" },
        create: {
          email: "quinn@example.test",
          name: "Quinn",
          image: "https://i.pravatar.cc/150?img=44",
        },
      }),
    ]);

  return { owner, jordan, casey, riley, morgan, alex, taylor, sam, quinn };
}

export type Users = Awaited<ReturnType<typeof seedUsers>>;

export function registerSeedUsers(plan: SeedPlan) {
  plan.users.push(seedUsers);
}
