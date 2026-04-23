import {
  PrismaClient,
  PermissionAction,
  EntryStatus,
  InviteType,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ROLE_KEYS } from "@/lib/rbac";
import { localToUTC } from "@/lib/date-utils";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const ALL_OWNER_PERMISSIONS = Object.values(PermissionAction);

/**
 * Returns UTC-aware timetable entry helpers scoped to a given IANA timezone.
 * All timetable entries use these so stored UTC times reflect org local time.
 *
 * To change an org timezone: update the tz arg and the org record.
 */
function makeDateUtils(tz: string) {
  const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const [ty, tm, td] = todayLocal.split("-").map(Number);

  function localDateForOffset(offsetDays: number): string {
    const d = new Date(Date.UTC(ty, tm - 1, td + offsetDays));
    return d.toISOString().slice(0, 10);
  }

  function utcEntry(
    offsetDays: number,
    localHHMM: string,
    durationMin: number,
  ) {
    const { utcDate, utcStartTimeMin } = localToUTC(
      localDateForOffset(offsetDays),
      timeToMin(localHHMM),
      tz,
    );
    return {
      date: utcDate,
      startTimeMin: utcStartTimeMin,
      endTimeMin: Math.min(utcStartTimeMin + durationMin, 1440),
    };
  }

  return { utcEntry };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLEAN
//
// Add new models here (in child-before-parent order) as the schema grows.
// ─────────────────────────────────────────────────────────────────────────────

async function cleanDatabase() {
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
  await prisma.invite.deleteMany();
  await prisma.role.deleteMany();
  await prisma.franchiseToken.deleteMany();
  await prisma.timetableSettings.deleteMany();
  // Clear self-referential FK before deleting orgs
  await prisma.$executeRaw`UPDATE "Organization" SET "parentId" = NULL WHERE "parentId" IS NOT NULL`;
  await prisma.organization.deleteMany();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. USERS
//
// Upsert-only — keeps existing OAuth sessions alive across re-seeds.
// To add a user: add an upsert, destructure it, and include it in the return.
// ─────────────────────────────────────────────────────────────────────────────

async function seedUsers() {
  const [ivan, jordan, casey, riley, morgan, alex, taylor, sam] =
    await Promise.all([
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
      prisma.user.upsert({
        where: { email: "alt28922@gmail.com" },
        update: { name: "Alex" },
        create: { email: "alt28922@gmail.com", name: "Alex" },
      }),
      prisma.user.upsert({
        where: { email: "alt28923@gmail.com" },
        update: { name: "Taylor" },
        create: { email: "alt28923@gmail.com", name: "Taylor" },
      }),
      prisma.user.upsert({
        where: { email: "alt28924@gmail.com" },
        update: { name: "Sam" },
        create: { email: "alt28924@gmail.com", name: "Sam" },
      }),
    ]);

  return { ivan, jordan, casey, riley, morgan, alex, taylor, sam };
}

type Users = Awaited<ReturnType<typeof seedUsers>>;

// ─────────────────────────────────────────────────────────────────────────────
// 3. ORG 1 — Donut Shop A
//    Owner: Ivan  |  Members: Jordan, Casey, Riley, Alex
// ─────────────────────────────────────────────────────────────────────────────

async function seedOrg1(users: Users) {
  const { ivan, jordan, casey, riley, alex } = users;
  const { utcEntry } = makeDateUtils("Australia/Sydney");

  const org = await prisma.organization.create({
    data: {
      name: "Donut Shop A",
      ownerId: ivan.id,
      openTimeMin: timeToMin("06:00"),
      closeTimeMin: timeToMin("18:00"),
      timezone: "Australia/Sydney",
      operatingDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
  });

  const [roleOwner, roleWorker, roleFryer, roleCounter] = await Promise.all([
    prisma.role.create({
      data: {
        orgId: org.id,
        name: "Owner",
        key: ROLE_KEYS.OWNER,
        color: "#ef4444",
        isDeletable: false,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org.id,
        name: "Default Member",
        key: ROLE_KEYS.DEFAULT_MEMBER,
        color: "#6b7280",
        isDeletable: false,
        isDefault: true,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org.id,
        name: "Fryer Operator",
        key: "fryer_op",
        color: "#F97316",
        isDeletable: true,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org.id,
        name: "Counter Staff",
        key: "counter_staff",
        color: "#06B6D4",
        isDeletable: true,
        isDefault: false,
      },
    }),
  ]);

  await prisma.permission.createMany({
    data: [
      ...ALL_OWNER_PERMISSIONS.map((action) => ({
        roleId: roleOwner.id,
        action,
      })),
      { roleId: roleWorker.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: roleFryer.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: roleCounter.id, action: PermissionAction.VIEW_TIMETABLE },
    ],
    skipDuplicates: true,
  });

  const [mIvan, mJordan, mCasey, mRiley, mAlex] = await Promise.all([
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: ivan.id,
        workingDays: ["mon", "tue", "wed", "thu", "fri"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: jordan.id,
        workingDays: ["mon", "tue", "wed", "thu", "fri"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: casey.id,
        workingDays: ["tue", "wed", "thu", "fri", "sat"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: riley.id,
        workingDays: ["mon", "wed", "fri", "sat"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: alex.id,
        workingDays: ["tue", "thu", "sat", "sun"],
      },
    }),
  ]);

  // Bot placeholder — unfilled shift slot
  const mBotOpenSlot = await prisma.membership.create({
    data: {
      orgId: org.id,
      userId: null,
      botName: "Open Slot",
      workingDays: ["mon", "wed", "fri"],
    },
  });

  await prisma.memberRole.createMany({
    data: [
      { membershipId: mIvan.id, roleId: roleOwner.id },
      { membershipId: mJordan.id, roleId: roleWorker.id },
      { membershipId: mJordan.id, roleId: roleCounter.id },
      { membershipId: mCasey.id, roleId: roleWorker.id },
      { membershipId: mCasey.id, roleId: roleFryer.id },
      { membershipId: mRiley.id, roleId: roleWorker.id },
      { membershipId: mAlex.id, roleId: roleWorker.id },
      { membershipId: mAlex.id, roleId: roleFryer.id },
      { membershipId: mBotOpenSlot.id, roleId: roleWorker.id },
    ],
  });

  const [tOpen, tIceCream, tClose, tFry, tRestock, tQuality] =
    await Promise.all([
      prisma.task.create({
        data: {
          orgId: org.id,
          name: "Open shop checklist",
          color: "#F59E0B",
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
          orgId: org.id,
          name: "Clean ice cream machine",
          color: "#3B82F6",
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
          orgId: org.id,
          name: "Close shop checklist",
          color: "#8B5CF6",
          description: "Trash, mop, lock up, end of day report.",
          durationMin: 40,
          preferredStartTimeMin: timeToMin("17:00"),
          minPeople: 1,
          minWaitDays: 0,
          maxWaitDays: 1,
        },
      }),
      prisma.task.create({
        data: {
          orgId: org.id,
          name: "Fry donut batches",
          color: "#EF4444",
          description: "Prep and fry fresh donut batches for the day.",
          durationMin: 60,
          preferredStartTimeMin: timeToMin("08:00"),
          minPeople: 1,
          minWaitDays: 0,
          maxWaitDays: 1,
        },
      }),
      prisma.task.create({
        data: {
          orgId: org.id,
          name: "Restock supplies",
          color: "#22C55E",
          description: "Check and restock napkins, boxes, and toppings.",
          durationMin: 30,
          preferredStartTimeMin: timeToMin("11:00"),
          minPeople: 1,
          minWaitDays: 1,
          maxWaitDays: 3,
        },
      }),
      prisma.task.create({
        data: {
          orgId: org.id,
          name: "Quality check",
          color: "#A855F7",
          description: "Inspect product quality and presentation standards.",
          durationMin: 20,
          preferredStartTimeMin: timeToMin("10:00"),
          minPeople: 1,
          minWaitDays: 0,
          maxWaitDays: 2,
        },
      }),
    ]);

  await prisma.taskEligibility.createMany({
    data: [
      ...[tOpen, tIceCream, tClose, tFry, tRestock, tQuality].map((t) => ({
        taskId: t.id,
        roleId: roleWorker.id,
      })),
      { taskId: tFry.id, roleId: roleFryer.id },
      { taskId: tRestock.id, roleId: roleCounter.id },
      { taskId: tQuality.id, roleId: roleFryer.id },
    ],
    skipDuplicates: true,
  });

  const template = await prisma.template.create({
    data: { orgId: org.id, name: "Week 1", cycleLengthDays: 7 },
  });

  await prisma.templateEntry.createMany({
    data: [
      {
        templateId: template.id,
        taskId: tOpen.id,
        dayIndex: 0,
        startTimeMin: timeToMin("06:00"),
        endTimeMin: timeToMin("06:30"),
      },
      {
        templateId: template.id,
        taskId: tIceCream.id,
        dayIndex: 2,
        startTimeMin: timeToMin("14:00"),
        endTimeMin: timeToMin("14:45"),
      },
      {
        templateId: template.id,
        taskId: tClose.id,
        dayIndex: 6,
        startTimeMin: timeToMin("17:00"),
        endTimeMin: timeToMin("17:40"),
      },
    ],
  });

  await Promise.all([
    // Past
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 30,
        ...utcEntry(-28, "06:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tIceCream.id,
        taskName: tIceCream.name,
        taskDescription: tIceCream.description,
        durationMin: 45,
        ...utcEntry(-26, "14:00", 45),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 40,
        ...utcEntry(-24, "17:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 30,
        ...utcEntry(-21, "06:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tIceCream.id,
        taskName: tIceCream.name,
        taskDescription: tIceCream.description,
        durationMin: 45,
        ...utcEntry(-19, "14:00", 45),
        status: EntryStatus.SKIPPED,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 40,
        ...utcEntry(-17, "17:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 30,
        ...utcEntry(-14, "06:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tIceCream.id,
        taskName: tIceCream.name,
        taskDescription: tIceCream.description,
        durationMin: 45,
        ...utcEntry(-12, "14:00", 45),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 40,
        ...utcEntry(-10, "17:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 30,
        ...utcEntry(-7, "06:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tIceCream.id,
        taskName: tIceCream.name,
        taskDescription: tIceCream.description,
        durationMin: 45,
        ...utcEntry(-5, "14:00", 45),
        status: EntryStatus.SKIPPED,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 40,
        ...utcEntry(-3, "17:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 30,
        ...utcEntry(-1, "06:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    // Today
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tIceCream.id,
        taskName: tIceCream.name,
        taskDescription: tIceCream.description,
        durationMin: 45,
        ...utcEntry(0, "14:00", 45),
        status: EntryStatus.IN_PROGRESS,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    // Tomorrow
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 40,
        ...utcEntry(1, "17:00", 40),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    // Today — additional tasks
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 30,
        ...utcEntry(0, "06:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tFry.id,
        taskName: tFry.name,
        taskDescription: tFry.description,
        durationMin: 60,
        ...utcEntry(0, "08:00", 60),
        status: EntryStatus.IN_PROGRESS,
        assignees: { create: [{ membershipId: mBotOpenSlot.id }] },
      },
    }),
    // Day +1 — additional
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tFry.id,
        taskName: tFry.name,
        taskDescription: tFry.description,
        durationMin: 60,
        ...utcEntry(1, "08:00", 60),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotOpenSlot.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tQuality.id,
        taskName: tQuality.name,
        taskDescription: tQuality.description,
        durationMin: 20,
        ...utcEntry(1, "10:00", 20),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mAlex.id }] },
      },
    }),
    // Day +2
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 30,
        ...utcEntry(2, "06:00", 30),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tFry.id,
        taskName: tFry.name,
        taskDescription: tFry.description,
        durationMin: 60,
        ...utcEntry(2, "08:00", 60),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotOpenSlot.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tRestock.id,
        taskName: tRestock.name,
        taskDescription: tRestock.description,
        durationMin: 30,
        ...utcEntry(2, "11:00", 30),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    // Day +3
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 30,
        ...utcEntry(3, "06:00", 30),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tQuality.id,
        taskName: tQuality.name,
        taskDescription: tQuality.description,
        durationMin: 20,
        ...utcEntry(3, "10:00", 20),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotOpenSlot.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 40,
        ...utcEntry(3, "17:00", 40),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    // Day +4
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tFry.id,
        taskName: tFry.name,
        taskDescription: tFry.description,
        durationMin: 60,
        ...utcEntry(4, "08:00", 60),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mAlex.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tRestock.id,
        taskName: tRestock.name,
        taskDescription: tRestock.description,
        durationMin: 30,
        ...utcEntry(4, "11:00", 30),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotOpenSlot.id }] },
      },
    }),
    // Day +5
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 30,
        ...utcEntry(5, "06:00", 30),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tFry.id,
        taskName: tFry.name,
        taskDescription: tFry.description,
        durationMin: 60,
        ...utcEntry(5, "08:00", 60),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotOpenSlot.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 40,
        ...utcEntry(5, "17:00", 40),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    // Day +6
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tQuality.id,
        taskName: tQuality.name,
        taskDescription: tQuality.description,
        durationMin: 20,
        ...utcEntry(6, "10:00", 20),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotOpenSlot.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tRestock.id,
        taskName: tRestock.name,
        taskDescription: tRestock.description,
        durationMin: 30,
        ...utcEntry(6, "11:00", 30),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    // Day +7
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 30,
        ...utcEntry(7, "06:00", 30),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mAlex.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tFry.id,
        taskName: tFry.name,
        taskDescription: tFry.description,
        durationMin: 60,
        ...utcEntry(7, "08:00", 60),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotOpenSlot.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 40,
        ...utcEntry(7, "17:00", 40),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    // Past bot entries
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tFry.id,
        taskName: tFry.name,
        taskDescription: tFry.description,
        durationMin: 60,
        ...utcEntry(-27, "08:00", 60),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mBotOpenSlot.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tRestock.id,
        taskName: tRestock.name,
        taskDescription: tRestock.description,
        durationMin: 30,
        ...utcEntry(-20, "11:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mBotOpenSlot.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tQuality.id,
        taskName: tQuality.name,
        taskDescription: tQuality.description,
        durationMin: 20,
        ...utcEntry(-13, "10:00", 20),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mBotOpenSlot.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tFry.id,
        taskName: tFry.name,
        taskDescription: tFry.description,
        durationMin: 60,
        ...utcEntry(-6, "08:00", 60),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mBotOpenSlot.id }] },
      },
    }),
  ]);

  return { org, roles: { roleOwner, roleWorker, roleFryer, roleCounter }, botOpenSlot: mBotOpenSlot };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ORG 2 — Coffee House B
//    Owner: Ivan  |  Members: Riley, Morgan, Jordan, Taylor
// ─────────────────────────────────────────────────────────────────────────────

async function seedOrg2(users: Users) {
  const { ivan, riley, morgan, jordan, taylor } = users;
  const { utcEntry } = makeDateUtils("Australia/Sydney");

  const org = await prisma.organization.create({
    data: {
      name: "Coffee House B",
      ownerId: ivan.id,
      openTimeMin: timeToMin("07:00"),
      closeTimeMin: timeToMin("17:00"),
      timezone: "Australia/Sydney",
      operatingDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
  });

  const [roleOwner, roleBarista, roleHeadBarista, roleKitchen] =
    await Promise.all([
      prisma.role.create({
        data: {
          orgId: org.id,
          name: "Owner",
          key: ROLE_KEYS.OWNER,
          color: "#ef4444",
          isDeletable: false,
          isDefault: false,
        },
      }),
      prisma.role.create({
        data: {
          orgId: org.id,
          name: "Barista",
          key: ROLE_KEYS.DEFAULT_MEMBER,
          color: "#6b7280",
          isDeletable: false,
          isDefault: true,
        },
      }),
      prisma.role.create({
        data: {
          orgId: org.id,
          name: "Head Barista",
          key: "head_barista",
          color: "#0EA5E9",
          isDeletable: true,
          isDefault: false,
        },
      }),
      prisma.role.create({
        data: {
          orgId: org.id,
          name: "Kitchen Hand",
          key: "kitchen_hand",
          color: "#84CC16",
          isDeletable: true,
          isDefault: false,
        },
      }),
    ]);

  await prisma.permission.createMany({
    data: [
      ...ALL_OWNER_PERMISSIONS.map((action) => ({
        roleId: roleOwner.id,
        action,
      })),
      { roleId: roleBarista.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: roleHeadBarista.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: roleHeadBarista.id, action: PermissionAction.MANAGE_TIMETABLE },
      { roleId: roleKitchen.id, action: PermissionAction.VIEW_TIMETABLE },
    ],
    skipDuplicates: true,
  });

  const [mIvan, mRiley, mMorgan, mJordan, mTaylor] = await Promise.all([
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: ivan.id,
        workingDays: ["mon", "tue", "wed", "thu", "fri"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: riley.id,
        workingDays: ["mon", "wed", "fri"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: morgan.id,
        workingDays: ["tue", "thu", "sat"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: jordan.id,
        workingDays: ["mon", "tue", "wed"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: taylor.id,
        workingDays: ["wed", "thu", "fri", "sat"],
      },
    }),
  ]);

  // Bot placeholder — unfilled barista slot
  const mBotSpare = await prisma.membership.create({
    data: {
      orgId: org.id,
      userId: null,
      botName: "Spare Barista",
      workingDays: ["tue", "fri"],
    },
  });

  await prisma.memberRole.createMany({
    data: [
      { membershipId: mIvan.id, roleId: roleOwner.id },
      { membershipId: mRiley.id, roleId: roleBarista.id },
      { membershipId: mRiley.id, roleId: roleHeadBarista.id },
      { membershipId: mMorgan.id, roleId: roleBarista.id },
      { membershipId: mJordan.id, roleId: roleBarista.id },
      { membershipId: mTaylor.id, roleId: roleBarista.id },
      { membershipId: mTaylor.id, roleId: roleKitchen.id },
      { membershipId: mBotSpare.id, roleId: roleBarista.id },
    ],
  });

  const [tOpen, tMachine, tClose, tMilk, tBeans, tClean] = await Promise.all([
    prisma.task.create({
      data: {
        orgId: org.id,
        name: "Open cafe checklist",
        color: "#F97316",
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
        orgId: org.id,
        name: "Clean espresso machine",
        color: "#14B8A6",
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
        orgId: org.id,
        name: "Close cafe checklist",
        color: "#6366F1",
        description: "Cash up, wipe down, lock up.",
        durationMin: 25,
        preferredStartTimeMin: timeToMin("16:30"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org.id,
        name: "Milk restocking",
        color: "#0891B2",
        description: "Check fridge levels and restock milk from cold storage.",
        durationMin: 15,
        preferredStartTimeMin: timeToMin("09:00"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org.id,
        name: "Coffee bean preparation",
        color: "#7C3AED",
        description: "Grind beans, calibrate grinder, prep portafilters.",
        durationMin: 20,
        preferredStartTimeMin: timeToMin("06:30"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org.id,
        name: "Customer area cleaning",
        color: "#059669",
        description: "Wipe tables, restock sugar and napkins, sweep floor.",
        durationMin: 30,
        preferredStartTimeMin: timeToMin("12:00"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 2,
      },
    }),
  ]);

  await prisma.taskEligibility.createMany({
    data: [
      ...[tOpen, tMachine, tClose, tMilk, tBeans, tClean].map((t) => ({
        taskId: t.id,
        roleId: roleBarista.id,
      })),
      { taskId: tMilk.id, roleId: roleKitchen.id },
      { taskId: tBeans.id, roleId: roleHeadBarista.id },
      { taskId: tClean.id, roleId: roleKitchen.id },
    ],
    skipDuplicates: true,
  });

  const template = await prisma.template.create({
    data: { orgId: org.id, name: "Standard Week", cycleLengthDays: 7 },
  });

  await prisma.templateEntry.createMany({
    data: [
      {
        templateId: template.id,
        taskId: tOpen.id,
        dayIndex: 0,
        startTimeMin: timeToMin("07:00"),
        endTimeMin: timeToMin("07:20"),
      },
      {
        templateId: template.id,
        taskId: tMachine.id,
        dayIndex: 3,
        startTimeMin: timeToMin("15:00"),
        endTimeMin: timeToMin("15:30"),
      },
      {
        templateId: template.id,
        taskId: tClose.id,
        dayIndex: 4,
        startTimeMin: timeToMin("16:30"),
        endTimeMin: timeToMin("16:55"),
      },
    ],
  });

  await Promise.all([
    // Past
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 20,
        ...utcEntry(-29, "07:00", 20),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tMachine.id,
        taskName: tMachine.name,
        taskDescription: tMachine.description,
        durationMin: 30,
        ...utcEntry(-27, "15:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mMorgan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 25,
        ...utcEntry(-25, "16:30", 25),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 20,
        ...utcEntry(-22, "07:00", 20),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mMorgan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tMachine.id,
        taskName: tMachine.name,
        taskDescription: tMachine.description,
        durationMin: 30,
        ...utcEntry(-20, "15:00", 30),
        status: EntryStatus.SKIPPED,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 25,
        ...utcEntry(-18, "16:30", 25),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mMorgan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 20,
        ...utcEntry(-15, "07:00", 20),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tMachine.id,
        taskName: tMachine.name,
        taskDescription: tMachine.description,
        durationMin: 30,
        ...utcEntry(-13, "15:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mMorgan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 25,
        ...utcEntry(-11, "16:30", 25),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 20,
        ...utcEntry(-8, "07:00", 20),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mMorgan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tMachine.id,
        taskName: tMachine.name,
        taskDescription: tMachine.description,
        durationMin: 30,
        ...utcEntry(-6, "15:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 25,
        ...utcEntry(-4, "16:30", 25),
        status: EntryStatus.SKIPPED,
        assignees: { create: [{ membershipId: mMorgan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 20,
        ...utcEntry(-2, "07:00", 20),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    // Today
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tMachine.id,
        taskName: tMachine.name,
        taskDescription: tMachine.description,
        durationMin: 30,
        ...utcEntry(0, "15:00", 30),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mMorgan.id }] },
      },
    }),
    // Tomorrow
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 25,
        ...utcEntry(1, "16:30", 25),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    // Today — additional
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 20,
        ...utcEntry(0, "07:00", 20),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tMilk.id,
        taskName: tMilk.name,
        taskDescription: tMilk.description,
        durationMin: 15,
        ...utcEntry(0, "09:00", 15),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotSpare.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tBeans.id,
        taskName: tBeans.name,
        taskDescription: tBeans.description,
        durationMin: 20,
        ...utcEntry(0, "06:30", 20),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    // Day +1 — additional
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tMilk.id,
        taskName: tMilk.name,
        taskDescription: tMilk.description,
        durationMin: 15,
        ...utcEntry(1, "09:00", 15),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotSpare.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClean.id,
        taskName: tClean.name,
        taskDescription: tClean.description,
        durationMin: 30,
        ...utcEntry(1, "12:00", 30),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mTaylor.id }] },
      },
    }),
    // Day +2
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 20,
        ...utcEntry(2, "07:00", 20),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mMorgan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tBeans.id,
        taskName: tBeans.name,
        taskDescription: tBeans.description,
        durationMin: 20,
        ...utcEntry(2, "06:30", 20),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotSpare.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClean.id,
        taskName: tClean.name,
        taskDescription: tClean.description,
        durationMin: 30,
        ...utcEntry(2, "12:00", 30),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    // Day +3
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tMilk.id,
        taskName: tMilk.name,
        taskDescription: tMilk.description,
        durationMin: 15,
        ...utcEntry(3, "09:00", 15),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotSpare.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tMachine.id,
        taskName: tMachine.name,
        taskDescription: tMachine.description,
        durationMin: 30,
        ...utcEntry(3, "15:00", 30),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 25,
        ...utcEntry(3, "16:30", 25),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mMorgan.id }] },
      },
    }),
    // Day +4
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 20,
        ...utcEntry(4, "07:00", 20),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tBeans.id,
        taskName: tBeans.name,
        taskDescription: tBeans.description,
        durationMin: 20,
        ...utcEntry(4, "06:30", 20),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotSpare.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClean.id,
        taskName: tClean.name,
        taskDescription: tClean.description,
        durationMin: 30,
        ...utcEntry(4, "12:00", 30),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mTaylor.id }] },
      },
    }),
    // Day +5
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tMilk.id,
        taskName: tMilk.name,
        taskDescription: tMilk.description,
        durationMin: 15,
        ...utcEntry(5, "09:00", 15),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotSpare.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 25,
        ...utcEntry(5, "16:30", 25),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    // Day +6
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tOpen.id,
        taskName: tOpen.name,
        taskDescription: tOpen.description,
        durationMin: 20,
        ...utcEntry(6, "07:00", 20),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mMorgan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClean.id,
        taskName: tClean.name,
        taskDescription: tClean.description,
        durationMin: 30,
        ...utcEntry(6, "12:00", 30),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotSpare.id }] },
      },
    }),
    // Day +7
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tMilk.id,
        taskName: tMilk.name,
        taskDescription: tMilk.description,
        durationMin: 15,
        ...utcEntry(7, "09:00", 15),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mTaylor.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tBeans.id,
        taskName: tBeans.name,
        taskDescription: tBeans.description,
        durationMin: 20,
        ...utcEntry(7, "06:30", 20),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mBotSpare.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClose.id,
        taskName: tClose.name,
        taskDescription: tClose.description,
        durationMin: 25,
        ...utcEntry(7, "16:30", 25),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    // Past bot entries
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tMilk.id,
        taskName: tMilk.name,
        taskDescription: tMilk.description,
        durationMin: 15,
        ...utcEntry(-28, "09:00", 15),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mBotSpare.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tBeans.id,
        taskName: tBeans.name,
        taskDescription: tBeans.description,
        durationMin: 20,
        ...utcEntry(-21, "06:30", 20),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mBotSpare.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tClean.id,
        taskName: tClean.name,
        taskDescription: tClean.description,
        durationMin: 30,
        ...utcEntry(-14, "12:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mBotSpare.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tMilk.id,
        taskName: tMilk.name,
        taskDescription: tMilk.description,
        durationMin: 15,
        ...utcEntry(-7, "09:00", 15),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mBotSpare.id }] },
      },
    }),
  ]);

  return {
    org,
    roles: { roleOwner, roleBarista, roleHeadBarista, roleKitchen },
    botSpare: mBotSpare,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ORG 3 — Bakery C
//    Owner: Jordan  |  Members: Casey, Riley, Morgan, Sam
// ─────────────────────────────────────────────────────────────────────────────

async function seedOrg3(users: Users) {
  const { jordan, casey, riley, morgan, sam } = users;
  const { utcEntry } = makeDateUtils("Australia/Sydney");

  const org = await prisma.organization.create({
    data: {
      name: "Bakery C",
      ownerId: jordan.id,
      openTimeMin: timeToMin("05:00"),
      closeTimeMin: timeToMin("14:00"),
      timezone: "Australia/Sydney",
      operatingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
    },
  });

  const [roleOwner, roleBaker, roleHeadBaker, rolePastry] = await Promise.all([
    prisma.role.create({
      data: {
        orgId: org.id,
        name: "Owner",
        key: ROLE_KEYS.OWNER,
        color: "#ef4444",
        isDeletable: false,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org.id,
        name: "Baker",
        key: ROLE_KEYS.DEFAULT_MEMBER,
        color: "#6b7280",
        isDeletable: false,
        isDefault: true,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org.id,
        name: "Head Baker",
        key: "head_baker",
        color: "#D97706",
        isDeletable: true,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org.id,
        name: "Pastry Chef",
        key: "pastry_chef",
        color: "#EC4899",
        isDeletable: true,
        isDefault: false,
      },
    }),
  ]);

  await prisma.permission.createMany({
    data: [
      ...ALL_OWNER_PERMISSIONS.map((action) => ({
        roleId: roleOwner.id,
        action,
      })),
      { roleId: roleBaker.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: roleHeadBaker.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: roleHeadBaker.id, action: PermissionAction.MANAGE_TIMETABLE },
      { roleId: rolePastry.id, action: PermissionAction.VIEW_TIMETABLE },
    ],
    skipDuplicates: true,
  });

  const [mJordan, mCasey, mRiley, mMorgan, mSam] = await Promise.all([
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: jordan.id,
        workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: casey.id,
        workingDays: ["mon", "wed", "fri", "sat"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: riley.id,
        workingDays: ["tue", "thu", "sat"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: morgan.id,
        workingDays: ["mon", "tue", "wed", "thu"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: sam.id,
        workingDays: ["wed", "thu", "fri", "sat"],
      },
    }),
  ]);

  await prisma.memberRole.createMany({
    data: [
      { membershipId: mJordan.id, roleId: roleOwner.id },
      { membershipId: mJordan.id, roleId: roleHeadBaker.id },
      { membershipId: mCasey.id, roleId: roleBaker.id },
      { membershipId: mCasey.id, roleId: rolePastry.id },
      { membershipId: mRiley.id, roleId: roleBaker.id },
      { membershipId: mMorgan.id, roleId: roleBaker.id },
      { membershipId: mMorgan.id, roleId: roleHeadBaker.id },
      { membershipId: mSam.id, roleId: roleBaker.id },
      { membershipId: mSam.id, roleId: rolePastry.id },
    ],
  });

  const [tPrep, tBread, tCleanup, tPastry, tWindow, tStock] = await Promise.all(
    [
      prisma.task.create({
        data: {
          orgId: org.id,
          name: "Morning prep",
          color: "#F59E0B",
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
          orgId: org.id,
          name: "Bread baking",
          color: "#10B981",
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
          orgId: org.id,
          name: "Evening cleanup",
          color: "#8B5CF6",
          description: "Clean ovens, sweep floor, store remaining stock.",
          durationMin: 40,
          preferredStartTimeMin: timeToMin("13:00"),
          minPeople: 1,
          minWaitDays: 0,
          maxWaitDays: 1,
        },
      }),
      prisma.task.create({
        data: {
          orgId: org.id,
          name: "Pastry preparation",
          color: "#F472B6",
          description:
            "Prepare croissants, danish, and daily pastry selection.",
          durationMin: 60,
          preferredStartTimeMin: timeToMin("05:30"),
          minPeople: 1,
          minWaitDays: 0,
          maxWaitDays: 1,
        },
      }),
      prisma.task.create({
        data: {
          orgId: org.id,
          name: "Window display setup",
          color: "#34D399",
          description: "Arrange today's baked goods in the shop window.",
          durationMin: 20,
          preferredStartTimeMin: timeToMin("08:00"),
          minPeople: 1,
          minWaitDays: 0,
          maxWaitDays: 2,
        },
      }),
      prisma.task.create({
        data: {
          orgId: org.id,
          name: "Stock count",
          color: "#60A5FA",
          description:
            "Audit flour, yeast, butter and other ingredient levels.",
          durationMin: 30,
          preferredStartTimeMin: timeToMin("13:00"),
          minPeople: 1,
          minWaitDays: 2,
          maxWaitDays: 7,
        },
      }),
    ],
  );

  await prisma.taskEligibility.createMany({
    data: [
      ...[tPrep, tBread, tCleanup, tPastry, tWindow, tStock].map((t) => ({
        taskId: t.id,
        roleId: roleBaker.id,
      })),
      { taskId: tPastry.id, roleId: rolePastry.id },
      { taskId: tWindow.id, roleId: roleHeadBaker.id },
      { taskId: tStock.id, roleId: roleHeadBaker.id },
    ],
    skipDuplicates: true,
  });

  const template = await prisma.template.create({
    data: { orgId: org.id, name: "5-Day Rotation", cycleLengthDays: 5 },
  });

  await prisma.templateEntry.createMany({
    data: [
      {
        templateId: template.id,
        taskId: tPrep.id,
        dayIndex: 0,
        startTimeMin: timeToMin("05:00"),
        endTimeMin: timeToMin("05:45"),
      },
      {
        templateId: template.id,
        taskId: tBread.id,
        dayIndex: 0,
        startTimeMin: timeToMin("06:00"),
        endTimeMin: timeToMin("07:30"),
      },
      {
        templateId: template.id,
        taskId: tCleanup.id,
        dayIndex: 4,
        startTimeMin: timeToMin("13:00"),
        endTimeMin: timeToMin("13:40"),
      },
    ],
  });

  await Promise.all([
    // Past
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tPrep.id,
        taskName: tPrep.name,
        taskDescription: tPrep.description,
        durationMin: 45,
        ...utcEntry(-30, "05:00", 45),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tBread.id,
        taskName: tBread.name,
        taskDescription: tBread.description,
        durationMin: 90,
        ...utcEntry(-30, "06:00", 90),
        status: EntryStatus.DONE,
        assignees: {
          create: [{ membershipId: mCasey.id }, { membershipId: mJordan.id }],
        },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tCleanup.id,
        taskName: tCleanup.name,
        taskDescription: tCleanup.description,
        durationMin: 40,
        ...utcEntry(-27, "13:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tPrep.id,
        taskName: tPrep.name,
        taskDescription: tPrep.description,
        durationMin: 45,
        ...utcEntry(-25, "05:00", 45),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tBread.id,
        taskName: tBread.name,
        taskDescription: tBread.description,
        durationMin: 90,
        ...utcEntry(-23, "06:00", 90),
        status: EntryStatus.SKIPPED,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tCleanup.id,
        taskName: tCleanup.name,
        taskDescription: tCleanup.description,
        durationMin: 40,
        ...utcEntry(-21, "13:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tPrep.id,
        taskName: tPrep.name,
        taskDescription: tPrep.description,
        durationMin: 45,
        ...utcEntry(-18, "05:00", 45),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tBread.id,
        taskName: tBread.name,
        taskDescription: tBread.description,
        durationMin: 90,
        ...utcEntry(-16, "06:00", 90),
        status: EntryStatus.DONE,
        assignees: {
          create: [{ membershipId: mCasey.id }, { membershipId: mJordan.id }],
        },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tCleanup.id,
        taskName: tCleanup.name,
        taskDescription: tCleanup.description,
        durationMin: 40,
        ...utcEntry(-14, "13:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tPrep.id,
        taskName: tPrep.name,
        taskDescription: tPrep.description,
        durationMin: 45,
        ...utcEntry(-11, "05:00", 45),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tBread.id,
        taskName: tBread.name,
        taskDescription: tBread.description,
        durationMin: 90,
        ...utcEntry(-9, "06:00", 90),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tCleanup.id,
        taskName: tCleanup.name,
        taskDescription: tCleanup.description,
        durationMin: 40,
        ...utcEntry(-7, "13:00", 40),
        status: EntryStatus.SKIPPED,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tPrep.id,
        taskName: tPrep.name,
        taskDescription: tPrep.description,
        durationMin: 45,
        ...utcEntry(-5, "05:00", 45),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mCasey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tBread.id,
        taskName: tBread.name,
        taskDescription: tBread.description,
        durationMin: 90,
        ...utcEntry(-3, "06:00", 90),
        status: EntryStatus.DONE,
        assignees: {
          create: [{ membershipId: mCasey.id }, { membershipId: mJordan.id }],
        },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tCleanup.id,
        taskName: tCleanup.name,
        taskDescription: tCleanup.description,
        durationMin: 40,
        ...utcEntry(-1, "13:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: mRiley.id }] },
      },
    }),
    // Today
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tPrep.id,
        taskName: tPrep.name,
        taskDescription: tPrep.description,
        durationMin: 45,
        ...utcEntry(0, "05:00", 45),
        status: EntryStatus.IN_PROGRESS,
        assignees: { create: [{ membershipId: mJordan.id }] },
      },
    }),
    // Tomorrow
    prisma.timetableEntry.create({
      data: {
        orgId: org.id,
        taskId: tBread.id,
        taskName: tBread.name,
        taskDescription: tBread.description,
        durationMin: 90,
        ...utcEntry(1, "06:00", 90),
        status: EntryStatus.TODO,
        assignees: {
          create: [{ membershipId: mCasey.id }, { membershipId: mJordan.id }],
        },
      },
    }),
  ]);

  return { org, roles: { roleOwner, roleBaker, roleHeadBaker, rolePastry } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. INVITES — Test data for notification panel
//
// Ivan (main dev account) is not a member of Bakery C, so a pending invite
// from Jordan is realistic. Add more rows here to test other edge cases.
// ─────────────────────────────────────────────────────────────────────────────

async function seedInvites(
  users: Users,
  org1: Awaited<ReturnType<typeof seedOrg1>>,
  org3: Awaited<ReturnType<typeof seedOrg3>>,
) {
  await prisma.invite.createMany({
    data: [
      // Pending — Ivan invited to join Bakery C by Jordan
      {
        orgId: org3.org.id,
        invitedById: users.jordan.id,
        recipientId: users.ivan.id,
        type: InviteType.MEMBER,
        orgName: "Bakery C",
        inviterName: "Jordan",
        metadata: {
          roleIds: [org3.roles.roleBaker.id],
          workingDays: ["mon", "wed", "fri"],
        },
      },
      // Bot-slot invite — Sam invited to fill "Open Slot" bot in Donut Shop A
      {
        orgId: org1.org.id,
        invitedById: users.ivan.id,
        recipientId: users.sam.id,
        type: InviteType.MEMBER,
        orgName: "Donut Shop A",
        inviterName: "Ivan",
        metadata: {
          roleIds: [org1.roles.roleWorker.id],
          workingDays: ["mon", "wed", "fri"],
          botMembershipId: org1.botOpenSlot.id,
        },
      },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

function confirm(): void {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const isProduction = !dbUrl.includes("mwivbmygangszkcnikcn");
  const expected = isProduction ? "production" : "development";
  const arg = process.argv[2];
  const host = new URL(dbUrl).host;

  console.log("");
  console.log(`  Target database : ${host}`);
  console.log(`  Environment     : ${expected.toUpperCase()}`);
  console.log("");

  if (arg !== expected) {
    if (isProduction) {
      console.log("  ⚠️  WARNING: This targets PRODUCTION. Run: pnpm seed:prod");
    } else {
      console.log("  Run: pnpm seed:dev");
    }
    console.log("  Aborted — nothing was changed.\n");
    process.exit(1);
  }

  if (isProduction) {
    console.log("  ⚠️  WARNING: This will WIPE and reseed PRODUCTION.");
    console.log("");
  }
}

async function main() {
  confirm();
  await cleanDatabase();
  const users = await seedUsers();

  // Orgs are independent — seed in parallel
  const [org1, org2, org3] = await Promise.all([
    seedOrg1(users),
    seedOrg2(users),
    seedOrg3(users),
  ]);

  await seedInvites(users, org1, org3);

  console.log("Seeded successfully:", {
    users: Object.fromEntries(Object.entries(users).map(([k, v]) => [k, v.id])),
    orgs: {
      "Donut Shop A": org1.org.id,
      "Coffee House B": org2.org.id,
      "Bakery C": org3.org.id,
    },
  });
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
