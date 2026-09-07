import type { Prisma } from "@prisma/client";
import type { SeedPlan } from "../seed-plan";
import { MAIN_DEV_EMAIL, seedDisplayName, seedEmail } from "@/lib/demo/seed-namespace";

/**
 * Shared seed user fixture set used by the demo database and any seed modules
 * that need the canonical seeded users.
 *
 * Helper function to resolve the seed email for the E2E test user.
 * Treats empty or whitespace-only strings as unset values.
 */
function resolveSeedEmail(): string {
  const envEmail = process.env.E2E_TEST_USER_EMAIL?.trim();
  return envEmail || seedEmail("riley");
}

// These are the canonical seed users for the demo database.
export async function seedUsers(prisma: Prisma.TransactionClient) {
  const [owner, jordan, casey, riley, morgan, alex, taylor, sam, quinn] =
    await Promise.all([
      prisma.user.upsert({
        where: { email: MAIN_DEV_EMAIL },
        update: {
          name: seedDisplayName("MainDev"),
          image: "https://i.pravatar.cc/150?img=3",
        },
        create: {
          email: MAIN_DEV_EMAIL,
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
          email: resolveSeedEmail(),
        },
        update: {
          name: process.env.E2E_TEST_USER_NAME ?? seedDisplayName("Riley"),
          image:
            process.env.E2E_TEST_USER_IMAGE ??
            "https://i.pravatar.cc/150?img=5",
        },
        create: {
          email: resolveSeedEmail(),
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