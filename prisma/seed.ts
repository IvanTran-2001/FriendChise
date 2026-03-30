import { PrismaClient, PermissionAction, EntryStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ROLE_KEYS } from "@/lib/rbac";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const OWNER_PERMISSIONS = Object.values(PermissionAction);

async function main() {
  // ── 1. Clean existing org/task data (preserve User & auth records) ─────────
  await prisma.timetableEntryAssignee.deleteMany();
  await prisma.templateEntryAssignee.deleteMany();
  await prisma.timetableEntry.deleteMany();
  await prisma.templateEntry.deleteMany();
  await prisma.template.deleteMany();
  await prisma.taskEligibility.deleteMany();
  await prisma.task.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.memberRole.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.role.deleteMany();
  await prisma.franchiseToken.deleteMany();
  await prisma.timetableSettings.deleteMany();
  await prisma.$executeRaw`UPDATE "Organization" SET "parentId" = NULL WHERE "parentId" IS NOT NULL`;
  await prisma.organization.deleteMany();

  // ── 2. Users (upsert — keeps existing OAuth accounts intact) ──────────────
  const [ivan, jordan, casey, riley, morgan] = await Promise.all([
    prisma.user.upsert({
      where: { email: "mystoganx2001@gmail.com" },
      update: { name: "Ivan" },
      create: { email: "mystoganx2001@gmail.com", name: "Ivan" },
    }),
    prisma.user.upsert({
      where: { email: "alt28918@gmail.com" },
      update: { name: "Jordan" },
      create: { email: "alt28918@gmail.com", name: "Jordan" },
    }),
    prisma.user.upsert({
      where: { email: "alt28919@gmail.com" },
      update: { name: "Casey" },
      create: { email: "alt28919@gmail.com", name: "Casey" },
    }),
    prisma.user.upsert({
      where: { email: "alt28920@gmail.com" },
      update: { name: "Riley" },
      create: { email: "alt28920@gmail.com", name: "Riley" },
    }),
    prisma.user.upsert({
      where: { email: "alt28921@gmail.com" },
      update: { name: "Morgan" },
      create: { email: "alt28921@gmail.com", name: "Morgan" },
    }),
  ]);

  // ── 3. Compute Monday of the current week (Australia/Sydney timezone) ──────
  const ORG_TZ = "Australia/Sydney";
  const todayLocal = new Date().toLocaleDateString("en-CA", {
    timeZone: ORG_TZ,
  });
  const [ty, tm, td] = todayLocal.split("-").map(Number);
  const probeNoon = Date.UTC(ty, tm - 1, td, 12);
  const localWd = new Intl.DateTimeFormat("en-US", {
    timeZone: ORG_TZ,
    weekday: "short",
  }).format(new Date(probeNoon));
  const DOW: Record<string, number> = {
    Sun: -6,
    Mon: 0,
    Tue: -1,
    Wed: -2,
    Thu: -3,
    Fri: -4,
    Sat: -5,
  };
  const mondayDate = new Date(Date.UTC(ty, tm - 1, td + (DOW[localWd] ?? 0)));
  const [my, mm, md] = mondayDate
    .toISOString()
    .split("T")[0]
    .split("-")
    .map(Number);

  /** Returns midnight UTC for the given day offset from Monday (0 = Mon). */
  const dayDate = (dayIndex: number): Date =>
    new Date(Date.UTC(my, mm - 1, md + dayIndex));

  // ──────────────────────────────────────────────────────────────────────────
  // ORG 1: Donut Shop A  (Ivan owns · Jordan + Casey work)
  // ──────────────────────────────────────────────────────────────────────────
  const org1 = await prisma.organization.create({
    data: {
      name: "Donut Shop A",
      ownerId: ivan.id,
      openTimeMin: timeToMin("06:00"),
      closeTimeMin: timeToMin("18:00"),
      timezone: "Australia/Sydney",
      operatingDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
  });

  const [o1Owner, o1Worker] = await Promise.all([
    prisma.role.create({
      data: {
        orgId: org1.id,
        name: "Owner",
        key: ROLE_KEYS.OWNER,
        isDeletable: false,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org1.id,
        name: "Worker",
        key: ROLE_KEYS.DEFAULT_MEMBER,
        isDeletable: false,
        isDefault: true,
      },
    }),
  ]);

  await prisma.permission.createMany({
    data: OWNER_PERMISSIONS.map((action) => ({ roleId: o1Owner.id, action })),
    skipDuplicates: true,
  });
  await prisma.permission.create({
    data: { roleId: o1Worker.id, action: PermissionAction.VIEW_TIMETABLE },
  });

  const [o1Ivan, o1Jordan, o1Casey] = await Promise.all([
    prisma.membership.create({
      data: {
        orgId: org1.id,
        userId: ivan.id,
        workingDays: ["mon", "tue", "wed", "thu", "fri"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org1.id,
        userId: jordan.id,
        workingDays: ["mon", "tue", "wed", "thu", "fri"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org1.id,
        userId: casey.id,
        workingDays: ["tue", "wed", "thu", "fri", "sat"],
      },
    }),
  ]);

  await prisma.memberRole.createMany({
    data: [
      { membershipId: o1Ivan.id, roleId: o1Owner.id },
      { membershipId: o1Jordan.id, roleId: o1Worker.id },
      { membershipId: o1Casey.id, roleId: o1Worker.id },
    ],
  });

  const [o1Task1, o1Task2, o1Task3] = await Promise.all([
    prisma.task.create({
      data: {
        orgId: org1.id,
        name: "Open shop checklist",
        description: "Turn on lights, start fryer, prep counter.",
        durationMin: 30,
        preferredStartTimeMin: timeToMin("06:00"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org1.id,
        name: "Clean ice cream machine",
        description: "Full sanitize cycle.",
        durationMin: 45,
        preferredStartTimeMin: timeToMin("14:00"),
        minPeople: 1,
        minWaitDays: 2,
        maxWaitDays: 3,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org1.id,
        name: "Close shop checklist",
        description: "Trash, mop, lock up, end of day report.",
        durationMin: 40,
        preferredStartTimeMin: timeToMin("17:00"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
  ]);

  await prisma.taskEligibility.createMany({
    data: [o1Task1, o1Task2, o1Task3].map((t) => ({
      taskId: t.id,
      roleId: o1Worker.id,
    })),
    skipDuplicates: true,
  });

  const o1Template = await prisma.template.create({
    data: { orgId: org1.id, name: "Week 1", cycleLengthDays: 7 },
  });

  await prisma.templateEntry.createMany({
    data: [
      {
        templateId: o1Template.id,
        taskId: o1Task1.id,
        dayIndex: 0,
        startTimeMin: timeToMin("06:00"),
        endTimeMin: timeToMin("06:30"),
      },
      {
        templateId: o1Template.id,
        taskId: o1Task2.id,
        dayIndex: 2,
        startTimeMin: timeToMin("14:00"),
        endTimeMin: timeToMin("14:45"),
      },
      {
        templateId: o1Template.id,
        taskId: o1Task3.id,
        dayIndex: 6,
        startTimeMin: timeToMin("17:00"),
        endTimeMin: timeToMin("17:40"),
      },
    ],
  });

  // Live timetable entries — Org 1
  await Promise.all([
    prisma.timetableEntry.create({
      data: {
        orgId: org1.id,
        taskId: o1Task1.id,
        taskName: o1Task1.name,
        taskDescription: o1Task1.description,
        durationMin: 30,
        date: dayDate(0),
        startTimeMin: timeToMin("06:00"),
        endTimeMin: timeToMin("06:30"),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o1Jordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org1.id,
        taskId: o1Task2.id,
        taskName: o1Task2.name,
        taskDescription: o1Task2.description,
        durationMin: 45,
        date: dayDate(2),
        startTimeMin: timeToMin("14:00"),
        endTimeMin: timeToMin("14:45"),
        status: EntryStatus.IN_PROGRESS,
        assignees: { create: [{ membershipId: o1Casey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org1.id,
        taskId: o1Task3.id,
        taskName: o1Task3.name,
        taskDescription: o1Task3.description,
        durationMin: 40,
        date: dayDate(4),
        startTimeMin: timeToMin("17:00"),
        endTimeMin: timeToMin("17:40"),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: o1Jordan.id }] },
      },
    }),
  ]);

  // ──────────────────────────────────────────────────────────────────────────
  // ORG 2: Coffee House B  (Ivan owns · Riley + Morgan work)
  // ──────────────────────────────────────────────────────────────────────────
  const org2 = await prisma.organization.create({
    data: {
      name: "Coffee House B",
      ownerId: ivan.id,
      openTimeMin: timeToMin("07:00"),
      closeTimeMin: timeToMin("17:00"),
      timezone: "Australia/Sydney",
      operatingDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
  });

  const [o2Owner, o2Barista] = await Promise.all([
    prisma.role.create({
      data: {
        orgId: org2.id,
        name: "Owner",
        key: ROLE_KEYS.OWNER,
        isDeletable: false,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org2.id,
        name: "Barista",
        key: ROLE_KEYS.DEFAULT_MEMBER,
        isDeletable: false,
        isDefault: true,
      },
    }),
  ]);

  await prisma.permission.createMany({
    data: OWNER_PERMISSIONS.map((action) => ({ roleId: o2Owner.id, action })),
    skipDuplicates: true,
  });
  await prisma.permission.create({
    data: { roleId: o2Barista.id, action: PermissionAction.VIEW_TIMETABLE },
  });

  const [o2Ivan, o2Riley, o2Morgan] = await Promise.all([
    prisma.membership.create({
      data: {
        orgId: org2.id,
        userId: ivan.id,
        workingDays: ["mon", "tue", "wed", "thu", "fri"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org2.id,
        userId: riley.id,
        workingDays: ["mon", "wed", "fri"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org2.id,
        userId: morgan.id,
        workingDays: ["tue", "thu", "sat"],
      },
    }),
  ]);

  await prisma.memberRole.createMany({
    data: [
      { membershipId: o2Ivan.id, roleId: o2Owner.id },
      { membershipId: o2Riley.id, roleId: o2Barista.id },
      { membershipId: o2Morgan.id, roleId: o2Barista.id },
    ],
  });

  const [o2Task1, o2Task2, o2Task3] = await Promise.all([
    prisma.task.create({
      data: {
        orgId: org2.id,
        name: "Open cafe checklist",
        description: "Unlock, start espresso machine, fill condiments.",
        durationMin: 20,
        preferredStartTimeMin: timeToMin("07:00"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org2.id,
        name: "Clean espresso machine",
        description: "Backflush, descale group heads, clean steam wand.",
        durationMin: 30,
        preferredStartTimeMin: timeToMin("15:00"),
        minPeople: 1,
        minWaitDays: 1,
        maxWaitDays: 2,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org2.id,
        name: "Close cafe checklist",
        description: "Cash up, wipe down, lock up.",
        durationMin: 25,
        preferredStartTimeMin: timeToMin("16:30"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
  ]);

  await prisma.taskEligibility.createMany({
    data: [o2Task1, o2Task2, o2Task3].map((t) => ({
      taskId: t.id,
      roleId: o2Barista.id,
    })),
    skipDuplicates: true,
  });

  const o2Template = await prisma.template.create({
    data: { orgId: org2.id, name: "Standard Week", cycleLengthDays: 7 },
  });

  await prisma.templateEntry.createMany({
    data: [
      {
        templateId: o2Template.id,
        taskId: o2Task1.id,
        dayIndex: 0,
        startTimeMin: timeToMin("07:00"),
        endTimeMin: timeToMin("07:20"),
      },
      {
        templateId: o2Template.id,
        taskId: o2Task2.id,
        dayIndex: 3,
        startTimeMin: timeToMin("15:00"),
        endTimeMin: timeToMin("15:30"),
      },
      {
        templateId: o2Template.id,
        taskId: o2Task3.id,
        dayIndex: 4,
        startTimeMin: timeToMin("16:30"),
        endTimeMin: timeToMin("16:55"),
      },
    ],
  });

  // Live timetable entries — Org 2
  await Promise.all([
    prisma.timetableEntry.create({
      data: {
        orgId: org2.id,
        taskId: o2Task1.id,
        taskName: o2Task1.name,
        taskDescription: o2Task1.description,
        durationMin: 20,
        date: dayDate(0),
        startTimeMin: timeToMin("07:00"),
        endTimeMin: timeToMin("07:20"),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o2Riley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org2.id,
        taskId: o2Task2.id,
        taskName: o2Task2.name,
        taskDescription: o2Task2.description,
        durationMin: 30,
        date: dayDate(1),
        startTimeMin: timeToMin("15:00"),
        endTimeMin: timeToMin("15:30"),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: o2Morgan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org2.id,
        taskId: o2Task3.id,
        taskName: o2Task3.name,
        taskDescription: o2Task3.description,
        durationMin: 25,
        date: dayDate(3),
        startTimeMin: timeToMin("16:30"),
        endTimeMin: timeToMin("16:55"),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: o2Morgan.id }] },
      },
    }),
  ]);

  // ──────────────────────────────────────────────────────────────────────────
  // ORG 3: Bakery C  (Jordan owns · Casey + Riley work)
  // ──────────────────────────────────────────────────────────────────────────
  const org3 = await prisma.organization.create({
    data: {
      name: "Bakery C",
      ownerId: jordan.id,
      openTimeMin: timeToMin("05:00"),
      closeTimeMin: timeToMin("14:00"),
      timezone: "Australia/Sydney",
      operatingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
    },
  });

  const [o3Owner, o3Baker] = await Promise.all([
    prisma.role.create({
      data: {
        orgId: org3.id,
        name: "Owner",
        key: ROLE_KEYS.OWNER,
        isDeletable: false,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org3.id,
        name: "Baker",
        key: ROLE_KEYS.DEFAULT_MEMBER,
        isDeletable: false,
        isDefault: true,
      },
    }),
  ]);

  await prisma.permission.createMany({
    data: OWNER_PERMISSIONS.map((action) => ({ roleId: o3Owner.id, action })),
    skipDuplicates: true,
  });
  await prisma.permission.create({
    data: { roleId: o3Baker.id, action: PermissionAction.VIEW_TIMETABLE },
  });

  const [o3Jordan, o3Casey, o3Riley] = await Promise.all([
    prisma.membership.create({
      data: {
        orgId: org3.id,
        userId: jordan.id,
        workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org3.id,
        userId: casey.id,
        workingDays: ["mon", "wed", "fri", "sat"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org3.id,
        userId: riley.id,
        workingDays: ["tue", "thu", "sat"],
      },
    }),
  ]);

  await prisma.memberRole.createMany({
    data: [
      { membershipId: o3Jordan.id, roleId: o3Owner.id },
      { membershipId: o3Casey.id, roleId: o3Baker.id },
      { membershipId: o3Riley.id, roleId: o3Baker.id },
    ],
  });

  const [o3Task1, o3Task2, o3Task3] = await Promise.all([
    prisma.task.create({
      data: {
        orgId: org3.id,
        name: "Morning prep",
        description: "Preheat ovens, prep dough, set up station.",
        durationMin: 45,
        preferredStartTimeMin: timeToMin("05:00"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org3.id,
        name: "Bread baking",
        description: "Score and bake loaves for the day.",
        durationMin: 90,
        preferredStartTimeMin: timeToMin("06:00"),
        minPeople: 2,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org3.id,
        name: "Evening cleanup",
        description: "Clean ovens, sweep floor, store remaining stock.",
        durationMin: 40,
        preferredStartTimeMin: timeToMin("13:00"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
  ]);

  await prisma.taskEligibility.createMany({
    data: [o3Task1, o3Task2, o3Task3].map((t) => ({
      taskId: t.id,
      roleId: o3Baker.id,
    })),
    skipDuplicates: true,
  });

  const o3Template = await prisma.template.create({
    data: { orgId: org3.id, name: "5-Day Rotation", cycleLengthDays: 5 },
  });

  await prisma.templateEntry.createMany({
    data: [
      {
        templateId: o3Template.id,
        taskId: o3Task1.id,
        dayIndex: 0,
        startTimeMin: timeToMin("05:00"),
        endTimeMin: timeToMin("05:45"),
      },
      {
        templateId: o3Template.id,
        taskId: o3Task2.id,
        dayIndex: 0,
        startTimeMin: timeToMin("06:00"),
        endTimeMin: timeToMin("07:30"),
      },
      {
        templateId: o3Template.id,
        taskId: o3Task3.id,
        dayIndex: 4,
        startTimeMin: timeToMin("13:00"),
        endTimeMin: timeToMin("13:40"),
      },
    ],
  });

  // Live timetable entries — Org 3
  await Promise.all([
    prisma.timetableEntry.create({
      data: {
        orgId: org3.id,
        taskId: o3Task1.id,
        taskName: o3Task1.name,
        taskDescription: o3Task1.description,
        durationMin: 45,
        date: dayDate(0),
        startTimeMin: timeToMin("05:00"),
        endTimeMin: timeToMin("05:45"),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o3Casey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org3.id,
        taskId: o3Task2.id,
        taskName: o3Task2.name,
        taskDescription: o3Task2.description,
        durationMin: 90,
        date: dayDate(0),
        startTimeMin: timeToMin("06:00"),
        endTimeMin: timeToMin("07:30"),
        status: EntryStatus.DONE,
        assignees: {
          create: [{ membershipId: o3Casey.id }, { membershipId: o3Jordan.id }],
        },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org3.id,
        taskId: o3Task3.id,
        taskName: o3Task3.name,
        taskDescription: o3Task3.description,
        durationMin: 40,
        date: dayDate(4),
        startTimeMin: timeToMin("13:00"),
        endTimeMin: timeToMin("13:40"),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: o3Riley.id }] },
      },
    }),
  ]);

  console.log("Seeded successfully:");
  console.log({
    users: {
      ivan: ivan.id,
      jordan: jordan.id,
      casey: casey.id,
      riley: riley.id,
      morgan: morgan.id,
    },
    orgs: {
      "Donut Shop A": org1.id,
      "Coffee House B": org2.id,
      "Bakery C": org3.id,
    },
  });
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
