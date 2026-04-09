import { PrismaClient, PermissionAction, EntryStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ROLE_KEYS } from "@/lib/rbac";
import { localToUTC } from "@/lib/date-utils";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** Converts an "HH:MM" string to total minutes from midnight. */
function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const OWNER_PERMISSIONS = Object.values(PermissionAction);

/**
 * Main seed function.
 *
 * Wipes all org-scoped data (keeping User/Account rows so OAuth sessions
 * survive a re-seed) then recreates:
 *   - 8 users (Ivan, Jordan, Casey, Riley, Morgan, Alex, Taylor, Sam)
 *   - 3 orgs (Donut Shop A, Coffee House B, Bakery C)
 *   - 4 roles per org (Owner + Default Member system roles + 2 custom roles)
 *   - 5 members per org with role assignments
 *   - 6 task definitions per org with role eligibility
 *   - 1 timetable template per org
 *   - ~14 historical + 2 upcoming timetable entries per org
 */
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
  const [ivan, jordan, casey, riley, morgan, alex, taylor, sam] = await Promise.all([
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

  // ── 3. Date helpers ────────────────────────────────────────────────────────
  const ORG_TZ = "Australia/Sydney";
  const todayLocal = new Date().toLocaleDateString("en-CA", {
    timeZone: ORG_TZ,
  });
  const [ty, tm, td] = todayLocal.split("-").map(Number);

  /** Returns the local YYYY-MM-DD string for `offsetDays` from today in `ORG_TZ`. */
  const localDateForOffset = (offsetDays: number): string => {
    const d = new Date(Date.UTC(ty, tm - 1, td + offsetDays));
    return d.toISOString().slice(0, 10);
  };

  /**
   * Returns UTC-stored `{ date, startTimeMin, endTimeMin }` for a seed entry.
   * Converts a local wall-clock time (relative to `ORG_TZ`) to absolute UTC.
   */
  const utcEntry = (
    offsetDays: number,
    localHHMM: string,
    durationMin: number,
  ) => {
    const { utcDate, utcStartTimeMin } = localToUTC(
      localDateForOffset(offsetDays),
      timeToMin(localHHMM),
      ORG_TZ,
    );
    return {
      date: utcDate,
      startTimeMin: utcStartTimeMin,
      endTimeMin: Math.min(utcStartTimeMin + durationMin, 1440),
    };
  };

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

  const [o1Owner, o1Worker, o1Fryer, o1Counter] = await Promise.all([
    prisma.role.create({
      data: {
        orgId: org1.id,
        name: "Owner",
        key: ROLE_KEYS.OWNER,
        color: "#ef4444",
        isDeletable: false,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org1.id,
        name: "Default Member",
        key: ROLE_KEYS.DEFAULT_MEMBER,
        color: "#6b7280",
        isDeletable: false,
        isDefault: true,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org1.id,
        name: "Fryer Operator",
        key: "fryer_op",
        color: "#F97316",
        isDeletable: true,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org1.id,
        name: "Counter Staff",
        key: "counter_staff",
        color: "#06B6D4",
        isDeletable: true,
        isDefault: false,
      },
    }),
  ]);

  await prisma.permission.createMany({
    data: OWNER_PERMISSIONS.map((action) => ({ roleId: o1Owner.id, action })),
    skipDuplicates: true,
  });
  await prisma.permission.createMany({
    data: [
      { roleId: o1Worker.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: o1Fryer.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: o1Counter.id, action: PermissionAction.VIEW_TIMETABLE },
    ],
    skipDuplicates: true,
  });

  const [o1Ivan, o1Jordan, o1Casey, o1Riley, o1Alex] = await Promise.all([
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
    prisma.membership.create({
      data: {
        orgId: org1.id,
        userId: riley.id,
        workingDays: ["mon", "wed", "fri", "sat"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org1.id,
        userId: alex.id,
        workingDays: ["tue", "thu", "sat", "sun"],
      },
    }),
  ]);

  await prisma.memberRole.createMany({
    data: [
      { membershipId: o1Ivan.id, roleId: o1Owner.id },
      { membershipId: o1Jordan.id, roleId: o1Worker.id },
      { membershipId: o1Jordan.id, roleId: o1Counter.id },
      { membershipId: o1Casey.id, roleId: o1Worker.id },
      { membershipId: o1Casey.id, roleId: o1Fryer.id },
      { membershipId: o1Riley.id, roleId: o1Worker.id },
      { membershipId: o1Alex.id, roleId: o1Worker.id },
      { membershipId: o1Alex.id, roleId: o1Fryer.id },
    ],
  });

  const [o1Task1, o1Task2, o1Task3, o1Task4, o1Task5, o1Task6] = await Promise.all([
    prisma.task.create({
      data: {
        orgId: org1.id,
        name: "Open shop checklist",
        description: "Turn on lights, start fryer, prep counter.",
        color: "#F59E0B",
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
        color: "#3B82F6",
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
        color: "#8B5CF6",
        durationMin: 40,
        preferredStartTimeMin: timeToMin("17:00"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org1.id,
        name: "Fry donut batches",
        description: "Prep and fry fresh donut batches for the day.",
        color: "#EF4444",
        durationMin: 60,
        preferredStartTimeMin: timeToMin("08:00"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org1.id,
        name: "Restock supplies",
        description: "Check and restock napkins, boxes, and toppings.",
        color: "#22C55E",
        durationMin: 30,
        preferredStartTimeMin: timeToMin("11:00"),
        minPeople: 1,
        minWaitDays: 1,
        maxWaitDays: 3,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org1.id,
        name: "Quality check",
        description: "Inspect product quality and presentation standards.",
        color: "#A855F7",
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
      ...[o1Task1, o1Task2, o1Task3, o1Task4, o1Task5, o1Task6].map((t) => ({ taskId: t.id, roleId: o1Worker.id })),
      { taskId: o1Task4.id, roleId: o1Fryer.id },
      { taskId: o1Task5.id, roleId: o1Counter.id },
      { taskId: o1Task6.id, roleId: o1Fryer.id },
    ],
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

  // Live timetable entries — Org 1 (past month + tomorrow)
  await Promise.all([
    // ── past entries (DONE / SKIPPED) ──
    prisma.timetableEntry.create({
      data: {
        orgId: org1.id,
        taskId: o1Task1.id,
        taskName: o1Task1.name,
        taskDescription: o1Task1.description,
        durationMin: 30,
        ...utcEntry(-28, "06:00", 30),
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
        ...utcEntry(-26, "14:00", 45),
        status: EntryStatus.DONE,
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
        ...utcEntry(-24, "17:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o1Jordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org1.id,
        taskId: o1Task1.id,
        taskName: o1Task1.name,
        taskDescription: o1Task1.description,
        durationMin: 30,
        ...utcEntry(-21, "06:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o1Casey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org1.id,
        taskId: o1Task2.id,
        taskName: o1Task2.name,
        taskDescription: o1Task2.description,
        durationMin: 45,
        ...utcEntry(-19, "14:00", 45),
        status: EntryStatus.SKIPPED,
        assignees: { create: [{ membershipId: o1Jordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org1.id,
        taskId: o1Task3.id,
        taskName: o1Task3.name,
        taskDescription: o1Task3.description,
        durationMin: 40,
        ...utcEntry(-17, "17:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o1Casey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org1.id,
        taskId: o1Task1.id,
        taskName: o1Task1.name,
        taskDescription: o1Task1.description,
        durationMin: 30,
        ...utcEntry(-14, "06:00", 30),
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
        ...utcEntry(-12, "14:00", 45),
        status: EntryStatus.DONE,
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
        ...utcEntry(-10, "17:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o1Jordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org1.id,
        taskId: o1Task1.id,
        taskName: o1Task1.name,
        taskDescription: o1Task1.description,
        durationMin: 30,
        ...utcEntry(-7, "06:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o1Casey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org1.id,
        taskId: o1Task2.id,
        taskName: o1Task2.name,
        taskDescription: o1Task2.description,
        durationMin: 45,
        ...utcEntry(-5, "14:00", 45),
        status: EntryStatus.SKIPPED,
        assignees: { create: [{ membershipId: o1Jordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org1.id,
        taskId: o1Task3.id,
        taskName: o1Task3.name,
        taskDescription: o1Task3.description,
        durationMin: 40,
        ...utcEntry(-3, "17:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o1Casey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org1.id,
        taskId: o1Task1.id,
        taskName: o1Task1.name,
        taskDescription: o1Task1.description,
        durationMin: 30,
        ...utcEntry(-1, "06:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o1Jordan.id }] },
      },
    }),
    // ── today ──
    prisma.timetableEntry.create({
      data: {
        orgId: org1.id,
        taskId: o1Task2.id,
        taskName: o1Task2.name,
        taskDescription: o1Task2.description,
        durationMin: 45,
        ...utcEntry(0, "14:00", 45),
        status: EntryStatus.IN_PROGRESS,
        assignees: { create: [{ membershipId: o1Casey.id }] },
      },
    }),
    // ── tomorrow ──
    prisma.timetableEntry.create({
      data: {
        orgId: org1.id,
        taskId: o1Task3.id,
        taskName: o1Task3.name,
        taskDescription: o1Task3.description,
        durationMin: 40,
        ...utcEntry(1, "17:00", 40),
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

  const [o2Owner, o2Barista, o2HeadBarista, o2Kitchen] = await Promise.all([
    prisma.role.create({
      data: {
        orgId: org2.id,
        name: "Owner",
        key: ROLE_KEYS.OWNER,
        color: "#ef4444",
        isDeletable: false,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org2.id,
        name: "Barista",
        key: ROLE_KEYS.DEFAULT_MEMBER,
        color: "#6b7280",
        isDeletable: false,
        isDefault: true,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org2.id,
        name: "Head Barista",
        key: "head_barista",
        color: "#0EA5E9",
        isDeletable: true,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org2.id,
        name: "Kitchen Hand",
        key: "kitchen_hand",
        color: "#84CC16",
        isDeletable: true,
        isDefault: false,
      },
    }),
  ]);

  await prisma.permission.createMany({
    data: OWNER_PERMISSIONS.map((action) => ({ roleId: o2Owner.id, action })),
    skipDuplicates: true,
  });
  await prisma.permission.createMany({
    data: [
      { roleId: o2Barista.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: o2HeadBarista.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: o2HeadBarista.id, action: PermissionAction.MANAGE_TIMETABLE },
      { roleId: o2Kitchen.id, action: PermissionAction.VIEW_TIMETABLE },
    ],
    skipDuplicates: true,
  });

  const [o2Ivan, o2Riley, o2Morgan, o2Jordan, o2Taylor] = await Promise.all([
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
    prisma.membership.create({
      data: {
        orgId: org2.id,
        userId: jordan.id,
        workingDays: ["mon", "tue", "wed"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org2.id,
        userId: taylor.id,
        workingDays: ["wed", "thu", "fri", "sat"],
      },
    }),
  ]);

  await prisma.memberRole.createMany({
    data: [
      { membershipId: o2Ivan.id, roleId: o2Owner.id },
      { membershipId: o2Riley.id, roleId: o2Barista.id },
      { membershipId: o2Riley.id, roleId: o2HeadBarista.id },
      { membershipId: o2Morgan.id, roleId: o2Barista.id },
      { membershipId: o2Jordan.id, roleId: o2Barista.id },
      { membershipId: o2Taylor.id, roleId: o2Barista.id },
      { membershipId: o2Taylor.id, roleId: o2Kitchen.id },
    ],
  });

  const [o2Task1, o2Task2, o2Task3, o2Task4, o2Task5, o2Task6] = await Promise.all([
    prisma.task.create({
      data: {
        orgId: org2.id,
        name: "Open cafe checklist",
        description: "Unlock, start espresso machine, fill condiments.",
        color: "#F97316",
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
        color: "#14B8A6",
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
        color: "#6366F1",
        durationMin: 25,
        preferredStartTimeMin: timeToMin("16:30"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org2.id,
        name: "Milk restocking",
        description: "Check fridge levels and restock milk from cold storage.",
        color: "#0891B2",
        durationMin: 15,
        preferredStartTimeMin: timeToMin("09:00"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org2.id,
        name: "Coffee bean preparation",
        description: "Grind beans, calibrate grinder, prep portafilters.",
        color: "#7C3AED",
        durationMin: 20,
        preferredStartTimeMin: timeToMin("06:30"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org2.id,
        name: "Customer area cleaning",
        description: "Wipe tables, restock sugar and napkins, sweep floor.",
        color: "#059669",
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
      ...[o2Task1, o2Task2, o2Task3, o2Task4, o2Task5, o2Task6].map((t) => ({ taskId: t.id, roleId: o2Barista.id })),
      { taskId: o2Task4.id, roleId: o2Kitchen.id },
      { taskId: o2Task5.id, roleId: o2HeadBarista.id },
      { taskId: o2Task6.id, roleId: o2Kitchen.id },
    ],
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

  // Live timetable entries — Org 2 (past month + tomorrow)
  await Promise.all([
    // ── past entries ──
    prisma.timetableEntry.create({
      data: {
        orgId: org2.id,
        taskId: o2Task1.id,
        taskName: o2Task1.name,
        taskDescription: o2Task1.description,
        durationMin: 20,
        ...utcEntry(-29, "07:00", 20),
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
        ...utcEntry(-27, "15:00", 30),
        status: EntryStatus.DONE,
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
        ...utcEntry(-25, "16:30", 25),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o2Riley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org2.id,
        taskId: o2Task1.id,
        taskName: o2Task1.name,
        taskDescription: o2Task1.description,
        durationMin: 20,
        ...utcEntry(-22, "07:00", 20),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o2Morgan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org2.id,
        taskId: o2Task2.id,
        taskName: o2Task2.name,
        taskDescription: o2Task2.description,
        durationMin: 30,
        ...utcEntry(-20, "15:00", 30),
        status: EntryStatus.SKIPPED,
        assignees: { create: [{ membershipId: o2Riley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org2.id,
        taskId: o2Task3.id,
        taskName: o2Task3.name,
        taskDescription: o2Task3.description,
        durationMin: 25,
        ...utcEntry(-18, "16:30", 25),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o2Morgan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org2.id,
        taskId: o2Task1.id,
        taskName: o2Task1.name,
        taskDescription: o2Task1.description,
        durationMin: 20,
        ...utcEntry(-15, "07:00", 20),
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
        ...utcEntry(-13, "15:00", 30),
        status: EntryStatus.DONE,
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
        ...utcEntry(-11, "16:30", 25),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o2Riley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org2.id,
        taskId: o2Task1.id,
        taskName: o2Task1.name,
        taskDescription: o2Task1.description,
        durationMin: 20,
        ...utcEntry(-8, "07:00", 20),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o2Morgan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org2.id,
        taskId: o2Task2.id,
        taskName: o2Task2.name,
        taskDescription: o2Task2.description,
        durationMin: 30,
        ...utcEntry(-6, "15:00", 30),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o2Riley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org2.id,
        taskId: o2Task3.id,
        taskName: o2Task3.name,
        taskDescription: o2Task3.description,
        durationMin: 25,
        ...utcEntry(-4, "16:30", 25),
        status: EntryStatus.SKIPPED,
        assignees: { create: [{ membershipId: o2Morgan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org2.id,
        taskId: o2Task1.id,
        taskName: o2Task1.name,
        taskDescription: o2Task1.description,
        durationMin: 20,
        ...utcEntry(-2, "07:00", 20),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o2Riley.id }] },
      },
    }),
    // ── today ──
    prisma.timetableEntry.create({
      data: {
        orgId: org2.id,
        taskId: o2Task2.id,
        taskName: o2Task2.name,
        taskDescription: o2Task2.description,
        durationMin: 30,
        ...utcEntry(0, "15:00", 30),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: o2Morgan.id }] },
      },
    }),
    // ── tomorrow ──
    prisma.timetableEntry.create({
      data: {
        orgId: org2.id,
        taskId: o2Task3.id,
        taskName: o2Task3.name,
        taskDescription: o2Task3.description,
        durationMin: 25,
        ...utcEntry(1, "16:30", 25),
        status: EntryStatus.TODO,
        assignees: { create: [{ membershipId: o2Riley.id }] },
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

  const [o3Owner, o3Baker, o3HeadBaker, o3Pastry] = await Promise.all([
    prisma.role.create({
      data: {
        orgId: org3.id,
        name: "Owner",
        key: ROLE_KEYS.OWNER,
        color: "#ef4444",
        isDeletable: false,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org3.id,
        name: "Baker",
        key: ROLE_KEYS.DEFAULT_MEMBER,
        color: "#6b7280",
        isDeletable: false,
        isDefault: true,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org3.id,
        name: "Head Baker",
        key: "head_baker",
        color: "#D97706",
        isDeletable: true,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org3.id,
        name: "Pastry Chef",
        key: "pastry_chef",
        color: "#EC4899",
        isDeletable: true,
        isDefault: false,
      },
    }),
  ]);

  await prisma.permission.createMany({
    data: OWNER_PERMISSIONS.map((action) => ({ roleId: o3Owner.id, action })),
    skipDuplicates: true,
  });
  await prisma.permission.createMany({
    data: [
      { roleId: o3Baker.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: o3HeadBaker.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: o3HeadBaker.id, action: PermissionAction.MANAGE_TIMETABLE },
      { roleId: o3Pastry.id, action: PermissionAction.VIEW_TIMETABLE },
    ],
    skipDuplicates: true,
  });

  const [o3Jordan, o3Casey, o3Riley, o3Morgan, o3Sam] = await Promise.all([
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
    prisma.membership.create({
      data: {
        orgId: org3.id,
        userId: morgan.id,
        workingDays: ["mon", "tue", "wed", "thu"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org3.id,
        userId: sam.id,
        workingDays: ["wed", "thu", "fri", "sat"],
      },
    }),
  ]);

  await prisma.memberRole.createMany({
    data: [
      { membershipId: o3Jordan.id, roleId: o3Owner.id },
      { membershipId: o3Jordan.id, roleId: o3HeadBaker.id },
      { membershipId: o3Casey.id, roleId: o3Baker.id },
      { membershipId: o3Casey.id, roleId: o3Pastry.id },
      { membershipId: o3Riley.id, roleId: o3Baker.id },
      { membershipId: o3Morgan.id, roleId: o3Baker.id },
      { membershipId: o3Morgan.id, roleId: o3HeadBaker.id },
      { membershipId: o3Sam.id, roleId: o3Baker.id },
      { membershipId: o3Sam.id, roleId: o3Pastry.id },
    ],
  });

  const [o3Task1, o3Task2, o3Task3, o3Task4, o3Task5, o3Task6] = await Promise.all([
    prisma.task.create({
      data: {
        orgId: org3.id,
        name: "Morning prep",
        description: "Preheat ovens, prep dough, set up station.",
        color: "#F59E0B",
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
        color: "#10B981",
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
        color: "#8B5CF6",
        durationMin: 40,
        preferredStartTimeMin: timeToMin("13:00"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org3.id,
        name: "Pastry preparation",
        description: "Prepare croissants, danish, and daily pastry selection.",
        color: "#F472B6",
        durationMin: 60,
        preferredStartTimeMin: timeToMin("05:30"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org3.id,
        name: "Window display setup",
        description: "Arrange today's baked goods in the shop window.",
        color: "#34D399",
        durationMin: 20,
        preferredStartTimeMin: timeToMin("08:00"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 2,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org3.id,
        name: "Stock count",
        description: "Audit flour, yeast, butter and other ingredient levels.",
        color: "#60A5FA",
        durationMin: 30,
        preferredStartTimeMin: timeToMin("13:00"),
        minPeople: 1,
        minWaitDays: 2,
        maxWaitDays: 7,
      },
    }),
  ]);

  await prisma.taskEligibility.createMany({
    data: [
      ...[o3Task1, o3Task2, o3Task3, o3Task4, o3Task5, o3Task6].map((t) => ({ taskId: t.id, roleId: o3Baker.id })),
      { taskId: o3Task4.id, roleId: o3Pastry.id },
      { taskId: o3Task5.id, roleId: o3HeadBaker.id },
      { taskId: o3Task6.id, roleId: o3HeadBaker.id },
    ],
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

  // Live timetable entries — Org 3 (past month + tomorrow)
  await Promise.all([
    // ── past entries ──
    prisma.timetableEntry.create({
      data: {
        orgId: org3.id,
        taskId: o3Task1.id,
        taskName: o3Task1.name,
        taskDescription: o3Task1.description,
        durationMin: 45,
        ...utcEntry(-30, "05:00", 45),
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
        ...utcEntry(-30, "06:00", 90),
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
        ...utcEntry(-27, "13:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o3Riley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org3.id,
        taskId: o3Task1.id,
        taskName: o3Task1.name,
        taskDescription: o3Task1.description,
        durationMin: 45,
        ...utcEntry(-25, "05:00", 45),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o3Jordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org3.id,
        taskId: o3Task2.id,
        taskName: o3Task2.name,
        taskDescription: o3Task2.description,
        durationMin: 90,
        ...utcEntry(-23, "06:00", 90),
        status: EntryStatus.SKIPPED,
        assignees: { create: [{ membershipId: o3Casey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org3.id,
        taskId: o3Task3.id,
        taskName: o3Task3.name,
        taskDescription: o3Task3.description,
        durationMin: 40,
        ...utcEntry(-21, "13:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o3Riley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org3.id,
        taskId: o3Task1.id,
        taskName: o3Task1.name,
        taskDescription: o3Task1.description,
        durationMin: 45,
        ...utcEntry(-18, "05:00", 45),
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
        ...utcEntry(-16, "06:00", 90),
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
        ...utcEntry(-14, "13:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o3Riley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org3.id,
        taskId: o3Task1.id,
        taskName: o3Task1.name,
        taskDescription: o3Task1.description,
        durationMin: 45,
        ...utcEntry(-11, "05:00", 45),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o3Jordan.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org3.id,
        taskId: o3Task2.id,
        taskName: o3Task2.name,
        taskDescription: o3Task2.description,
        durationMin: 90,
        ...utcEntry(-9, "06:00", 90),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o3Casey.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org3.id,
        taskId: o3Task3.id,
        taskName: o3Task3.name,
        taskDescription: o3Task3.description,
        durationMin: 40,
        ...utcEntry(-7, "13:00", 40),
        status: EntryStatus.SKIPPED,
        assignees: { create: [{ membershipId: o3Riley.id }] },
      },
    }),
    prisma.timetableEntry.create({
      data: {
        orgId: org3.id,
        taskId: o3Task1.id,
        taskName: o3Task1.name,
        taskDescription: o3Task1.description,
        durationMin: 45,
        ...utcEntry(-5, "05:00", 45),
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
        ...utcEntry(-3, "06:00", 90),
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
        ...utcEntry(-1, "13:00", 40),
        status: EntryStatus.DONE,
        assignees: { create: [{ membershipId: o3Riley.id }] },
      },
    }),
    // ── today ──
    prisma.timetableEntry.create({
      data: {
        orgId: org3.id,
        taskId: o3Task1.id,
        taskName: o3Task1.name,
        taskDescription: o3Task1.description,
        durationMin: 45,
        ...utcEntry(0, "05:00", 45),
        status: EntryStatus.IN_PROGRESS,
        assignees: { create: [{ membershipId: o3Jordan.id }] },
      },
    }),
    // ── tomorrow ──
    prisma.timetableEntry.create({
      data: {
        orgId: org3.id,
        taskId: o3Task2.id,
        taskName: o3Task2.name,
        taskDescription: o3Task2.description,
        durationMin: 90,
        ...utcEntry(1, "06:00", 90),
        status: EntryStatus.TODO,
        assignees: {
          create: [{ membershipId: o3Casey.id }, { membershipId: o3Jordan.id }],
        },
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
      alex: alex.id,
      taylor: taylor.id,
      sam: sam.id,
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
