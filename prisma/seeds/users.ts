import type { SeedPlan } from "./seed-plan";
import { seedDisplayName, seedEmail } from "@/lib/seed-namespace";

export async function seedUsers(prisma: import("@prisma/client").PrismaClient) {
  const [owner, jordan, casey, riley, morgan, alex, taylor, sam, quinn] =
    await Promise.all([
      prisma.user.upsert({
        where: { email: seedEmail("owner") },
        update: {
          name: seedDisplayName("MainDev"),
          image: "https://i.pravatar.cc/150?img=3",
        },
        create: {
          email: seedEmail("owner"),
          name: seedDisplayName("MainDev"),
          image: "https://i.pravatar.cc/150?img=3",
        },
      }),
      prisma.user.upsert({
        where: { email: seedEmail("jordan") },
        update: {
          name: seedDisplayName("Jordan"),
          image: "https://i.pravatar.cc/150?img=8",
        },
        create: {
          email: seedEmail("jordan"),
          name: seedDisplayName("Jordan"),
          image: "https://i.pravatar.cc/150?img=8",
        },
      }),
      prisma.user.upsert({
        where: { email: seedEmail("casey") },
        update: {
          name: seedDisplayName("Casey"),
          image: "https://i.pravatar.cc/150?img=12",
        },
        create: {
          email: seedEmail("casey"),
          name: seedDisplayName("Casey"),
          image: "https://i.pravatar.cc/150?img=12",
        },
      }),
      prisma.user.upsert({
        where: {
          email: process.env.E2E_TEST_USER_EMAIL ?? seedEmail("riley"),
        },
        update: {
          name: process.env.E2E_TEST_USER_NAME ?? seedDisplayName("Riley"),
          image:
            process.env.E2E_TEST_USER_IMAGE ??
            "https://i.pravatar.cc/150?img=5",
        },
        create: {
          email: process.env.E2E_TEST_USER_EMAIL ?? seedEmail("riley"),
          name: process.env.E2E_TEST_USER_NAME ?? seedDisplayName("Riley"),
          image:
            process.env.E2E_TEST_USER_IMAGE ??
            "https://i.pravatar.cc/150?img=5",
        },
      }),
      prisma.user.upsert({
        where: { email: seedEmail("morgan") },
        update: {
          name: seedDisplayName("Morgan"),
          image: "https://i.pravatar.cc/150?img=22",
        },
        create: {
          email: seedEmail("morgan"),
          name: seedDisplayName("Morgan"),
          image: "https://i.pravatar.cc/150?img=22",
        },
      }),
      prisma.user.upsert({
        where: { email: seedEmail("alex") },
        update: {
          name: seedDisplayName("Alex"),
          image: "https://i.pravatar.cc/150?img=15",
        },
        create: {
          email: seedEmail("alex"),
          name: seedDisplayName("Alex"),
          image: "https://i.pravatar.cc/150?img=15",
        },
      }),
      prisma.user.upsert({
        where: { email: seedEmail("taylor") },
        update: {
          name: seedDisplayName("Taylor"),
          image: "https://i.pravatar.cc/150?img=29",
        },
        create: {
          email: seedEmail("taylor"),
          name: seedDisplayName("Taylor"),
          image: "https://i.pravatar.cc/150?img=29",
        },
      }),
      prisma.user.upsert({
        where: { email: seedEmail("sam") },
        update: {
          name: seedDisplayName("Sam"),
          image: "https://i.pravatar.cc/150?img=35",
        },
        create: {
          email: seedEmail("sam"),
          name: seedDisplayName("Sam"),
          image: "https://i.pravatar.cc/150?img=35",
        },
      }),
      prisma.user.upsert({
        where: { email: seedEmail("quinn") },
        update: {
          name: seedDisplayName("Quinn"),
          image: "https://i.pravatar.cc/150?img=44",
        },
        create: {
          email: seedEmail("quinn"),
          name: seedDisplayName("Quinn"),
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
