import fs from "fs";
import path from "path";

import {
  PrismaClient,
  PermissionAction,
  EntryStatus,
  ViewType,
  TaskScope,
} from "@prisma/client";
import { ROLE_KEYS } from "@/lib/rbac";
import type { SeedPlan } from "../../seed-plan";
import {
  ALL_OWNER_PERMISSIONS,
  getMondayUTC,
  makeDateUtils,
  timeToMin,
  toSlug,
  uploadOrgLogo,
  uploadSeedTaskImage,
} from "../../helpers";
import { DONUT_TASKS } from "./data";
import { TASK_IMAGE_KEYWORDS, TASK_TAGS } from "./donut-shop-a-metadata";
import type { Users } from "../../users";

// ─────────────────────────────────────────────────────────────────────────────
// 3. ORG 1 — Donut Shop A
//    Owner: MainDev  |  Members: Jordan, Casey, Riley, Alex + 5 bots
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDonutShopA(prisma: PrismaClient, users: Users) {
  const { owner, jordan, casey, riley, alex } = users;
  const { utcEntry } = makeDateUtils("Australia/Sydney");

  // ── Org ────────────────────────────────────────────────────────────────────
  console.log("→ Creating org...");
  const org = await prisma.organization.create({
    data: {
      name: "Donut Shop A",
      ownerId: owner.id,
      image: null,
      address: "42 Harbour Street, Sydney NSW 2000",
      openTimeMin: timeToMin("06:00"),
      closeTimeMin: timeToMin("18:00"),
      timezone: "Australia/Sydney",
      operatingDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
  });
  console.log(`  ✓ Org created (id: ${org.id})`);

  // Upload org logo
  const org1LogoPath = path.resolve(
    process.cwd(),
    "public",
    "donut_a_logo.jpg",
  );
  if (fs.existsSync(org1LogoPath)) {
    const logoBuffer = fs.readFileSync(org1LogoPath);
    const logoStoragePath = await uploadOrgLogo(toSlug(org.name), logoBuffer);
    if (logoStoragePath) {
      await prisma.organization.update({
        where: { id: org.id },
        data: { image: logoStoragePath },
      });
      console.log("  ✓ Org logo uploaded");
    }
  }

  // ── Roles ──────────────────────────────────────────────────────────────────
  console.log("→ Creating roles...");
  const [roleOwner, roleWorker, roleFryer, roleCounter, roleShiftLead, roleTrainee] =
    await prisma.role
      .createManyAndReturn({
        data: [
          { orgId: org.id, name: "Owner",          key: ROLE_KEYS.OWNER,         color: "#ef4444", isDeletable: false, isDefault: false },
          { orgId: org.id, name: "Default Member", key: ROLE_KEYS.DEFAULT_MEMBER, color: "#6b7280", isDeletable: false, isDefault: true  },
          { orgId: org.id, name: "Fryer Operator", key: "fryer_op",               color: "#F97316", isDeletable: true,  isDefault: false },
          { orgId: org.id, name: "Counter Staff",  key: "counter_staff",          color: "#06B6D4", isDeletable: true,  isDefault: false },
          { orgId: org.id, name: "Shift Lead",     key: "shift_lead",             color: "#8B5CF6", isDeletable: true,  isDefault: false },
          { orgId: org.id, name: "Trainee",        key: "trainee",                color: "#84CC16", isDeletable: true,  isDefault: false },
        ],
      })
      .then((rows) => [
        rows.find((r) => r.key === ROLE_KEYS.OWNER)!,
        rows.find((r) => r.key === ROLE_KEYS.DEFAULT_MEMBER)!,
        rows.find((r) => r.key === "fryer_op")!,
        rows.find((r) => r.key === "counter_staff")!,
        rows.find((r) => r.key === "shift_lead")!,
        rows.find((r) => r.key === "trainee")!,
      ] as const);
  console.log("  ✓ 6 roles created");

  // ── Permissions ────────────────────────────────────────────────────────────
  console.log("→ Creating permissions...");
  await prisma.permission.createMany({
    data: [
      // Owner — all
      ...ALL_OWNER_PERMISSIONS.map((action: PermissionAction) => ({
        roleId: roleOwner.id,
        action,
      })),
      // Default Member — view only
      { roleId: roleWorker.id, action: PermissionAction.VIEW_TIMETABLE },
      // Fryer Operator — view timetable + manage tasks
      { roleId: roleFryer.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: roleFryer.id, action: PermissionAction.MANAGE_TASKS },
      // Counter Staff — view timetable
      { roleId: roleCounter.id, action: PermissionAction.VIEW_TIMETABLE },
      // Shift Lead — view + manage timetable + manage members
      { roleId: roleShiftLead.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: roleShiftLead.id, action: PermissionAction.MANAGE_TIMETABLE },
      { roleId: roleShiftLead.id, action: PermissionAction.MANAGE_MEMBERS },
      // Trainee — view only
      { roleId: roleTrainee.id, action: PermissionAction.VIEW_TIMETABLE },
    ],
    skipDuplicates: true,
  });
  console.log("  ✓ Permissions created");

  // ── Memberships ────────────────────────────────────────────────────────────
  console.log("→ Creating memberships...");
  const _memberships = await prisma.membership.createManyAndReturn({
    data: [
      { orgId: org.id, userId: owner.id,   workingDays: ["mon", "tue", "wed", "thu", "fri"] },
      { orgId: org.id, userId: jordan.id, workingDays: ["mon", "tue", "wed", "thu", "fri"] },
      { orgId: org.id, userId: casey.id,  workingDays: ["tue", "wed", "thu", "fri", "sat"] },
      { orgId: org.id, userId: riley.id,  workingDays: ["mon", "wed", "fri", "sat"] },
      { orgId: org.id, userId: alex.id,   workingDays: ["tue", "thu", "sat", "sun"] },
      { orgId: org.id, userId: null, botName: "Open Slot",       workingDays: ["mon", "wed", "fri"] },
      { orgId: org.id, userId: null, botName: "Morning Runner",  workingDays: ["tue", "thu", "sat"] },
      { orgId: org.id, userId: null, botName: "Fryer Backup",    workingDays: ["mon", "tue", "wed"] },
      { orgId: org.id, userId: null, botName: "Counter Float",   workingDays: ["wed", "fri", "sun"] },
      { orgId: org.id, userId: null, botName: "Weekend Fill",    workingDays: ["sat", "sun"] },
    ],
  });
  const _mOwner           = _memberships.find((m) => m.userId === owner.id)!;
  const mJordan           = _memberships.find((m) => m.userId === jordan.id)!;
  const mCasey            = _memberships.find((m) => m.userId === casey.id)!;
  const mRiley            = _memberships.find((m) => m.userId === riley.id)!;
  const mAlex             = _memberships.find((m) => m.userId === alex.id)!;
  const mBotOpenSlot      = _memberships.find((m) => m.botName === "Open Slot")!;
  const mBotMorningRunner = _memberships.find((m) => m.botName === "Morning Runner")!;
  const mBotFryerBackup   = _memberships.find((m) => m.botName === "Fryer Backup")!;
  const mBotCounterFloat  = _memberships.find((m) => m.botName === "Counter Float")!;
  const mBotWeekendFill   = _memberships.find((m) => m.botName === "Weekend Fill")!;
  console.log("  ✓ 5 members + 5 bots created");

  // ── Member Roles ───────────────────────────────────────────────────────────
  await prisma.memberRole.createMany({
    data: [
      { membershipId: _mOwner.id, roleId: roleOwner.id },
      // Jordan — shift lead + counter
      { membershipId: mJordan.id, roleId: roleWorker.id },
      { membershipId: mJordan.id, roleId: roleShiftLead.id },
      { membershipId: mJordan.id, roleId: roleCounter.id },
      // Casey — fryer + counter
      { membershipId: mCasey.id, roleId: roleWorker.id },
      { membershipId: mCasey.id, roleId: roleFryer.id },
      { membershipId: mCasey.id, roleId: roleCounter.id },
      // Riley — shift lead + fryer
      { membershipId: mRiley.id, roleId: roleWorker.id },
      { membershipId: mRiley.id, roleId: roleShiftLead.id },
      { membershipId: mRiley.id, roleId: roleFryer.id },
      // Alex — trainee
      { membershipId: mAlex.id, roleId: roleWorker.id },
      { membershipId: mAlex.id, roleId: roleTrainee.id },
      // Bots
      { membershipId: mBotOpenSlot.id, roleId: roleWorker.id },
      { membershipId: mBotMorningRunner.id, roleId: roleCounter.id },
      { membershipId: mBotFryerBackup.id, roleId: roleFryer.id },
      { membershipId: mBotCounterFloat.id, roleId: roleCounter.id },
      { membershipId: mBotWeekendFill.id, roleId: roleWorker.id },
    ],
  });
  console.log("  ✓ Member roles assigned");

  // ── Tasks ──────────────────────────────────────────────────────────────────
  console.log(`→ Creating ${DONUT_TASKS.length} tasks...`);
  const roleByKey: Record<string, string> = {
    counter_staff: roleCounter.id,
    fryer_op: roleFryer.id,
    shift_lead: roleShiftLead.id,
    trainee: roleTrainee.id,
    default_member: roleWorker.id,
  };

  // Validate all role keys exist before batch inserts
  for (const taskDef of DONUT_TASKS) {
    if (roleByKey[taskDef.assignedTo] === undefined) {
      throw new Error(
        `Role key "${taskDef.assignedTo}" not found in roleByKey lookup for task "${taskDef.title}". Available keys: ${Object.keys(roleByKey).join(", ")}`,
      );
    }
  }
  const _createdTaskRows = await prisma.task.createManyAndReturn({
    data: DONUT_TASKS.map((task) => ({
      orgId: org.id,
      name: task.title,
      color: task.priority,
      durationMin: task.estimatedMinutes,
      description: task.description,
      preferredStartTimeMin: timeToMin(task.scheduledTime),
      minPeople: 1,
      minWaitDays: task.retryCount,
      maxWaitDays: task.timeoutSeconds,
    })),
  });
  const _tasksByName = Object.fromEntries(_createdTaskRows.map((task) => [task.name, task]));
  await Promise.all([
    prisma.taskEligibility.createMany({
      data: DONUT_TASKS.map((taskDef) => ({
        taskId: _tasksByName[taskDef.title]!.id,
        roleId: roleByKey[taskDef.assignedTo]!,
      })),
    }),
    prisma.taskInheritance.createMany({
      data: _createdTaskRows.map((task) => ({ taskId: task.id, orgId: org.id })),
    }),
  ]);
  // Preserve the { task, roleKey }[] shape expected by downstream code
  const createdTasks = DONUT_TASKS.map((taskDef) => ({
    task: _tasksByName[taskDef.title]!,
    roleKey: taskDef.assignedTo,
  }));
  console.log(
    `  ✓ ${createdTasks.length} tasks + eligibilities + inheritances created`,
  );

  // ── Task Images ────────────────────────────────────────────────────────────
  console.log("→ Uploading task images...");
  // Phase 1: fetch + upload to Supabase in parallel (no DB connections)
  const uploadResults = await Promise.all(
    createdTasks.map(async ({ task }) => {
      const keyword = TASK_IMAGE_KEYWORDS[task.name] ?? "bakery,food";
      const storagePath = await uploadSeedTaskImage(
        toSlug(org.name),
        toSlug(task.name),
        keyword,
      );
      return { taskId: task.id, storagePath };
    }),
  );
  // Phase 2: update DB records sequentially to stay within the connection pool
  let uploadCount = 0;
  for (const { taskId, storagePath } of uploadResults) {
    if (storagePath) {
      await prisma.task.update({
        where: { id: taskId },
        data: { imageUrl: storagePath },
      });
      uploadCount++;
    }
  }
  console.log(`  ✓ ${uploadCount}/${createdTasks.length} task images uploaded`);

  // Publish brand-standard tasks as GLOBAL so franchisees can discover and inherit them
  const GLOBAL_TASK_NAMES = [
    // Core frying
    "Fry Morning Batches",
    "Fry Afternoon Batches",
    // Fillings
    "Make Custard Cream",
    "Make Choc Custard Cream",
    "Make Biscoff Filling",
    "Make Raspberry Cheesecake Filling",
    "Make Nutella Filling",
    "Make Peanut Butter Filling",
    // Glazes & fondants
    "Prepare Classic Glaze",
    "Prepare Chocolate Fondant",
    "Prepare Biscoff Fondant",
    // Drink recipes
    "Recipe: White Choc Biscoff Frappe",
    "Recipe: Honeycomb Frappe",
    "Recipe: Coffee Frappe",
    "Recipe: Salted Caramel Frappe",
    "Recipe: Matcha Frappe",
    "Recipe: Chocolate Milkshake",
    "Recipe: Biscoff Custard Shake",
    // Brand-standard SOPs
    "Open Shop Checklist",
    "Close Shop Checklist",
    "Quality Check \u2014 Display & Products",
  ];
  const { count: globalCount } = await prisma.task.updateMany({
    where: { orgId: org.id, name: { in: GLOBAL_TASK_NAMES } },
    data: { scope: TaskScope.GLOBAL },
  });
  console.log(`  ✓ ${globalCount} tasks published as GLOBAL`);

  // ── Tags ───────────────────────────────────────────────────────────────────
  console.log("→ Creating tags...");
  const tagByName: Record<string, { id: string }> = Object.fromEntries(
    (
      await prisma.tag.createManyAndReturn({
        data: [
          { orgId: org.id, name: "Daily Ops", color: "#F59E0B" },
          { orgId: org.id, name: "Fryer",     color: "#F97316" },
          { orgId: org.id, name: "Prep",      color: "#EC4899" },
          { orgId: org.id, name: "Recipe",    color: "#8B5CF6" },
          { orgId: org.id, name: "Cleaning",  color: "#22C55E" },
          { orgId: org.id, name: "Quality",   color: "#A855F7" },
          { orgId: org.id, name: "Opening",   color: "#3B82F6" },
          { orgId: org.id, name: "Closing",   color: "#EF4444" },
        ],
      })
    ).map((tag) => [tag.name, tag]),
  );
  console.log("  ✓ 8 tags created");

  // ── Task Tags ──────────────────────────────────────────────────────────────
  const taskTagRows = createdTasks.flatMap(({ task }) =>
    (TASK_TAGS[task.name] ?? []).map((tagName) => ({
      taskId: task.id,
      tagId: tagByName[tagName]!.id,
    })),
  );
  await prisma.taskTag.createMany({ data: taskTagRows, skipDuplicates: true });
  console.log(`  ✓ ${taskTagRows.length} task tags created`);

  // ── Task Comments — Make Biscoff Filling ───────────────────────────────────
  console.log("→ Creating task comments...");
  const biscoffTask = _tasksByName["Make Biscoff Filling"]!;

  const topLevelComments = await prisma.taskComment.createManyAndReturn({
    data: [
      {
        taskId: biscoffTask.id, orgId: org.id,
        authorId: casey.id, authorName: "Casey", authorImage: "https://i.pravatar.cc/150?img=12",
        content: "Just a heads up — the Biscoff spread can seize if the oil isn't warm enough. Make sure the vegetable oil is at least at room temp before mixing.",
        isPinned: true, pinnedAt: new Date(),
      },
      {
        taskId: biscoffTask.id, orgId: org.id,
        authorId: jordan.id, authorName: "Jordan", authorImage: "https://i.pravatar.cc/150?img=8",
        content: "We ran out of Biscoff mid-batch last Tuesday. Can someone make sure we always have at least 2 backup jars in the storeroom before the morning shift?",
      },
      {
        taskId: biscoffTask.id, orgId: org.id,
        authorId: owner.id, authorName: "MainDev", authorImage: "https://i.pravatar.cc/150?img=3",
        content: "The 4% vegetable oil ratio in the recipe is the minimum — if the spread feels too thick after mixing, bump it up slightly. Don't go over 6% or it'll be too runny.",
      },
      {
        taskId: biscoffTask.id, orgId: org.id,
        authorId: riley.id, authorName: "Riley", authorImage: "https://i.pravatar.cc/150?img=5",
        content: "Reminder to always wet the scoop with cold water before measuring — the spread sticks badly otherwise and you'll lose product on the sides.",
      },
    ],
    select: { id: true, authorId: true },
  });

  const [c1, c2, c3, c4] = [
    topLevelComments.find((c) => c.authorId === casey.id)!,
    topLevelComments.find((c) => c.authorId === jordan.id)!,
    topLevelComments.find((c) => c.authorId === owner.id)!,
    topLevelComments.find((c) => c.authorId === riley.id)!,
  ];

  // Replies
  await prisma.taskComment.createMany({
    data: [
      {
        taskId: biscoffTask.id, orgId: org.id,
        authorId: jordan.id, authorName: "Jordan", authorImage: "https://i.pravatar.cc/150?img=8",
        content: "Good call Casey. I had it seize on me once — had to bin the whole batch. Warming the oil for 10 sec in the microwave first fixes it every time.",
        parentId: c1.id,
      },
      {
        taskId: biscoffTask.id, orgId: org.id,
        authorId: casey.id, authorName: "Casey", authorImage: "https://i.pravatar.cc/150?img=12",
        content: "Agreed, added a note to the storeroom checklist. Also flagged it on the weekly order form so we auto-reorder when stock drops below 2 jars.",
        parentId: c2.id,
      },
      {
        taskId: biscoffTask.id, orgId: org.id,
        authorId: alex.id, authorName: "Alex", authorImage: "https://i.pravatar.cc/150?img=15",
        content: "Thanks MainDev, didn't know there was a range. The batch I made yesterday felt a bit thick so I'll try 5% next time.",
        parentId: c3.id,
      },
      {
        taskId: biscoffTask.id, orgId: org.id,
        authorId: owner.id, authorName: "MainDev", authorImage: "https://i.pravatar.cc/150?img=3",
        content: "Yep, same trick works for the Nutella filling too.",
        parentId: c4.id,
      },
    ],
  });
  console.log("  ✓ 8 task comments created (Make Biscoff Filling)");

  // Quick lookup helpers
  const tByName = Object.fromEntries(
    createdTasks.map(({ task }) => [task.name, task]),
  );
  const t = (name: string) => {
    const task = tByName[name];
    if (task === undefined) {
      throw new Error(
        `Task "${name}" not found in tByName lookup. Available tasks: ${Object.keys(tByName).join(", ")}`,
      );
    }
    return task;
  };

  // ── Templates ──────────────────────────────────────────────────────────────
  console.log("→ Creating templates...");

  const [tplWeek1, tplWeekend, tplCleaning] = await Promise.all([
    prisma.timetableTemplate.create({
      data: { orgId: org.id, name: "Weekday Rotation", cycleLengthDays: 5 },
    }),
    prisma.timetableTemplate.create({
      data: { orgId: org.id, name: "Weekend Shift", cycleLengthDays: 2 },
    }),
    prisma.timetableTemplate.create({
      data: {
        orgId: org.id,
        name: "Weekly Cleaning Schedule",
        cycleLengthDays: 7,
      },
    }),
  ]);

  await prisma.timetableTemplateEntry.createMany({
    data: [
      // Weekday Rotation (5-day cycle)
      {
        templateId: tplWeek1.id,
        taskId: t("Open Shop Checklist").id,
        dayIndex: 0,
        startTimeMin: timeToMin("06:00"),
        endTimeMin: timeToMin("06:30"),
      },
      {
        templateId: tplWeek1.id,
        taskId: t("Fry Morning Batches").id,
        dayIndex: 0,
        startTimeMin: timeToMin("07:00"),
        endTimeMin: timeToMin("08:00"),
      },
      {
        templateId: tplWeek1.id,
        taskId: t("Mid-Day Stock Check").id,
        dayIndex: 0,
        startTimeMin: timeToMin("12:00"),
        endTimeMin: timeToMin("12:20"),
      },
      {
        templateId: tplWeek1.id,
        taskId: t("Fry Afternoon Batches").id,
        dayIndex: 0,
        startTimeMin: timeToMin("13:00"),
        endTimeMin: timeToMin("13:45"),
      },
      {
        templateId: tplWeek1.id,
        taskId: t("Close Shop Checklist").id,
        dayIndex: 0,
        startTimeMin: timeToMin("17:00"),
        endTimeMin: timeToMin("17:45"),
      },
      {
        templateId: tplWeek1.id,
        taskId: t("Fryer Oil Quality Check").id,
        dayIndex: 2,
        startTimeMin: timeToMin("07:30"),
        endTimeMin: timeToMin("07:45"),
      },
      {
        templateId: tplWeek1.id,
        taskId: t("Quality Check — Display & Products").id,
        dayIndex: 2,
        startTimeMin: timeToMin("10:00"),
        endTimeMin: timeToMin("10:20"),
      },
      {
        templateId: tplWeek1.id,
        taskId: t("Restock Packaging & Supplies").id,
        dayIndex: 4,
        startTimeMin: timeToMin("11:00"),
        endTimeMin: timeToMin("11:25"),
      },
      // Weekend Shift (2-day cycle)
      {
        templateId: tplWeekend.id,
        taskId: t("Open Shop Checklist").id,
        dayIndex: 0,
        startTimeMin: timeToMin("06:00"),
        endTimeMin: timeToMin("06:30"),
      },
      {
        templateId: tplWeekend.id,
        taskId: t("Fry Morning Batches").id,
        dayIndex: 0,
        startTimeMin: timeToMin("07:00"),
        endTimeMin: timeToMin("08:00"),
      },
      {
        templateId: tplWeekend.id,
        taskId: t("Mid-Day Stock Check").id,
        dayIndex: 0,
        startTimeMin: timeToMin("12:00"),
        endTimeMin: timeToMin("12:20"),
      },
      {
        templateId: tplWeekend.id,
        taskId: t("Close Shop Checklist").id,
        dayIndex: 1,
        startTimeMin: timeToMin("17:00"),
        endTimeMin: timeToMin("17:45"),
      },
      // Weekly Cleaning
      {
        templateId: tplCleaning.id,
        taskId: t("Clean Ice Cream Machine").id,
        dayIndex: 0,
        startTimeMin: timeToMin("14:00"),
        endTimeMin: timeToMin("14:30"),
      },
      {
        templateId: tplCleaning.id,
        taskId: t("Deep Clean Hatco (Hot Jam) Unit").id,
        dayIndex: 1,
        startTimeMin: timeToMin("14:30"),
        endTimeMin: timeToMin("15:15"),
      },
      {
        templateId: tplCleaning.id,
        taskId: t("Deep Clean All Fridges").id,
        dayIndex: 3,
        startTimeMin: timeToMin("14:00"),
        endTimeMin: timeToMin("15:00"),
      },
      {
        templateId: tplCleaning.id,
        taskId: t("Deep Clean Doughnut Display").id,
        dayIndex: 4,
        startTimeMin: timeToMin("15:00"),
        endTimeMin: timeToMin("15:30"),
      },
      {
        templateId: tplCleaning.id,
        taskId: t("Clean & Tidy Storeroom").id,
        dayIndex: 6,
        startTimeMin: timeToMin("15:00"),
        endTimeMin: timeToMin("15:30"),
      },
      {
        templateId: tplCleaning.id,
        taskId: t("Clean Fryer (End of Day)").id,
        dayIndex: 0,
        startTimeMin: timeToMin("17:30"),
        endTimeMin: timeToMin("18:10"),
      },
    ],
  });
  console.log("  ✓ 3 templates created");

  // ── Timetable Settings ─────────────────────────────────────────────────────
  await prisma.timetableSettings.create({
    data: {
      orgId: org.id,
      viewType: ViewType.WEEKLY,
      startDay: "mon",
      slotDuration: 30,
    },
  });
  console.log("  ✓ Timetable settings created");

  // ── Timetable Entries ──────────────────────────────────────────────────────
  console.log("→ Creating timetable entries...");

  const entryData: {
    orgId: string;
    taskId: string;
    taskName: string;
    taskDescription: string | null;
    durationMin: number;
    date: Date;
    startTimeMin: number;
    endTimeMin: number;
    status: EntryStatus;
  }[] = [];
  // Maps composite key "taskId|dateMs|startTimeMin" → membershipId.
  // Used to look up assignees after createManyAndReturn (whose return order
  // is not guaranteed to match the input order).
  const entryMembershipByKey = new Map<string, string>();

  // Helper to queue entries
  const add = (
    taskName: string,
    offsetDays: number,
    hhmm: string,
    status: EntryStatus,
    membershipId: string,
  ) => {
    const task = t(taskName);
    const utc = utcEntry(offsetDays, hhmm, task.durationMin);
    entryData.push({
      orgId: org.id,
      taskId: task.id,
      taskName: task.name,
      taskDescription: task.description,
      durationMin: task.durationMin,
      ...utc,
      status,
    });
    const key = `${task.id}|${utc.date.getTime()}|${utc.startTimeMin}`;
    entryMembershipByKey.set(key, membershipId);
  };

  // ── 30 days of past history ────────────────────────────────────────────────
  // Day -30
  add("Open Shop Checklist", -30, "06:00", EntryStatus.DONE, mJordan.id);
  add("Fry Morning Batches", -30, "07:00", EntryStatus.DONE, mCasey.id);
  add("Make Custard Cream", -30, "06:30", EntryStatus.DONE, mBotFryerBackup.id);
  add("Close Shop Checklist", -30, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -29
  add(
    "Open Shop Checklist",
    -29,
    "06:00",
    EntryStatus.DONE,
    mBotMorningRunner.id,
  );
  add("Fry Morning Batches", -29, "07:00", EntryStatus.DONE, mCasey.id);
  add("Fryer Oil Quality Check", -29, "07:30", EntryStatus.DONE, mCasey.id);
  add(
    "Mid-Day Stock Check",
    -29,
    "12:00",
    EntryStatus.DONE,
    mBotCounterFloat.id,
  );
  add("Close Shop Checklist", -29, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -28
  add("Open Shop Checklist", -28, "06:00", EntryStatus.DONE, mJordan.id);
  add(
    "Fry Morning Batches",
    -28,
    "07:00",
    EntryStatus.DONE,
    mBotFryerBackup.id,
  );
  add("Make Biscoff Filling", -28, "07:00", EntryStatus.DONE, mCasey.id);
  add(
    "Clean Ice Cream Machine",
    -28,
    "14:00",
    EntryStatus.DONE,
    mBotCounterFloat.id,
  );
  add("Close Shop Checklist", -28, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -27
  add("Open Shop Checklist", -27, "06:00", EntryStatus.DONE, mBotOpenSlot.id);
  add("Fry Morning Batches", -27, "07:00", EntryStatus.DONE, mCasey.id);
  add(
    "Deep Clean Hatco (Hot Jam) Unit",
    -27,
    "14:30",
    EntryStatus.DONE,
    mCasey.id,
  );
  add("Close Shop Checklist", -27, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -26
  add("Open Shop Checklist", -26, "06:00", EntryStatus.DONE, mJordan.id);
  add(
    "Fry Morning Batches",
    -26,
    "07:00",
    EntryStatus.DONE,
    mBotFryerBackup.id,
  );
  add("Fry Afternoon Batches", -26, "13:00", EntryStatus.DONE, mCasey.id);
  add(
    "Restock Packaging & Supplies",
    -26,
    "11:00",
    EntryStatus.DONE,
    mBotMorningRunner.id,
  );
  add("Close Shop Checklist", -26, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -25
  add(
    "Open Shop Checklist",
    -25,
    "06:00",
    EntryStatus.DONE,
    mBotMorningRunner.id,
  );
  add("Fry Morning Batches", -25, "07:00", EntryStatus.DONE, mCasey.id);
  add(
    "Quality Check — Display & Products",
    -25,
    "10:00",
    EntryStatus.DONE,
    mJordan.id,
  );
  add(
    "Mid-Day Stock Check",
    -25,
    "12:00",
    EntryStatus.DONE,
    mBotCounterFloat.id,
  );
  add(
    "Close Shop Checklist",
    -25,
    "17:00",
    EntryStatus.SKIPPED,
    mBotWeekendFill.id,
  );

  // Day -24
  add("Open Shop Checklist", -24, "06:00", EntryStatus.DONE, mAlex.id);
  add(
    "Fry Morning Batches",
    -24,
    "07:00",
    EntryStatus.DONE,
    mBotFryerBackup.id,
  );
  add("Make Choc Custard Cream", -24, "06:45", EntryStatus.DONE, mCasey.id);
  add("Close Shop Checklist", -24, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -23
  add("Open Shop Checklist", -23, "06:00", EntryStatus.DONE, mJordan.id);
  add("Fry Morning Batches", -23, "07:00", EntryStatus.DONE, mCasey.id);
  add("Prepare Classic Glaze", -23, "07:30", EntryStatus.DONE, mCasey.id);
  add("Close Shop Checklist", -23, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -22
  add("Open Shop Checklist", -22, "06:00", EntryStatus.DONE, mBotOpenSlot.id);
  add(
    "Fry Morning Batches",
    -22,
    "07:00",
    EntryStatus.DONE,
    mBotFryerBackup.id,
  );
  add("Fryer Oil Quality Check", -22, "07:30", EntryStatus.DONE, mCasey.id);
  add(
    "Clean Ice Cream Machine",
    -22,
    "14:00",
    EntryStatus.DONE,
    mBotCounterFloat.id,
  );
  add("Close Shop Checklist", -22, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -21
  add("Open Shop Checklist", -21, "06:00", EntryStatus.DONE, mJordan.id);
  add("Fry Morning Batches", -21, "07:00", EntryStatus.DONE, mCasey.id);
  add(
    "Make Nutella Filling",
    -21,
    "07:00",
    EntryStatus.DONE,
    mBotFryerBackup.id,
  );
  add("Deep Clean All Fridges", -21, "14:00", EntryStatus.DONE, mRiley.id);
  add(
    "Close Shop Checklist",
    -21,
    "17:00",
    EntryStatus.DONE,
    mBotWeekendFill.id,
  );

  // Day -20
  add(
    "Open Shop Checklist",
    -20,
    "06:00",
    EntryStatus.DONE,
    mBotMorningRunner.id,
  );
  add("Fry Morning Batches", -20, "07:00", EntryStatus.DONE, mCasey.id);
  add(
    "Fry Afternoon Batches",
    -20,
    "13:00",
    EntryStatus.DONE,
    mBotFryerBackup.id,
  );
  add(
    "Deep Clean Doughnut Display",
    -20,
    "15:00",
    EntryStatus.DONE,
    mJordan.id,
  );
  add("Close Shop Checklist", -20, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -19
  add("Open Shop Checklist", -19, "06:00", EntryStatus.DONE, mAlex.id);
  add(
    "Fry Morning Batches",
    -19,
    "07:00",
    EntryStatus.DONE,
    mBotFryerBackup.id,
  );
  add(
    "Mid-Day Stock Check",
    -19,
    "12:00",
    EntryStatus.DONE,
    mBotCounterFloat.id,
  );
  add("Shift Handover", -19, "13:00", EntryStatus.DONE, mJordan.id);
  add("Close Shop Checklist", -19, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -18
  add("Open Shop Checklist", -18, "06:00", EntryStatus.DONE, mBotOpenSlot.id);
  add("Fry Morning Batches", -18, "07:00", EntryStatus.DONE, mCasey.id);
  add("Make Peanut Butter Filling", -18, "07:00", EntryStatus.DONE, mCasey.id);
  add("Clean Fryer (End of Day)", -18, "17:30", EntryStatus.DONE, mCasey.id);
  add("Close Shop Checklist", -18, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -17
  add("Open Shop Checklist", -17, "06:00", EntryStatus.DONE, mJordan.id);
  add(
    "Fry Morning Batches",
    -17,
    "07:00",
    EntryStatus.DONE,
    mBotFryerBackup.id,
  );
  add(
    "Fryer Oil Quality Check",
    -17,
    "07:30",
    EntryStatus.DONE,
    mBotFryerBackup.id,
  );
  add(
    "Quality Check — Display & Products",
    -17,
    "10:00",
    EntryStatus.DONE,
    mRiley.id,
  );
  add("Close Shop Checklist", -17, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -16
  add(
    "Open Shop Checklist",
    -16,
    "06:00",
    EntryStatus.DONE,
    mBotMorningRunner.id,
  );
  add("Fry Morning Batches", -16, "07:00", EntryStatus.DONE, mCasey.id);
  add("Prepare Biscoff Fondant", -16, "07:30", EntryStatus.DONE, mCasey.id);
  add("Close Shop Checklist", -16, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -15
  add("Open Shop Checklist", -15, "06:00", EntryStatus.DONE, mAlex.id);
  add(
    "Fry Morning Batches",
    -15,
    "07:00",
    EntryStatus.DONE,
    mBotFryerBackup.id,
  );
  add(
    "Make Raspberry Cheesecake Filling",
    -15,
    "07:00",
    EntryStatus.DONE,
    mCasey.id,
  );
  add(
    "Restock Packaging & Supplies",
    -15,
    "11:00",
    EntryStatus.DONE,
    mBotMorningRunner.id,
  );
  add("Close Shop Checklist", -15, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -14
  add("Open Shop Checklist", -14, "06:00", EntryStatus.DONE, mBotOpenSlot.id);
  add("Fry Morning Batches", -14, "07:00", EntryStatus.DONE, mCasey.id);
  add(
    "Clean Ice Cream Machine",
    -14,
    "14:00",
    EntryStatus.DONE,
    mBotCounterFloat.id,
  );
  add(
    "Close Shop Checklist",
    -14,
    "17:00",
    EntryStatus.SKIPPED,
    mBotWeekendFill.id,
  );

  // Day -13
  add("Open Shop Checklist", -13, "06:00", EntryStatus.DONE, mJordan.id);
  add(
    "Fry Morning Batches",
    -13,
    "07:00",
    EntryStatus.DONE,
    mBotFryerBackup.id,
  );
  add("Make Custard Cream", -13, "06:30", EntryStatus.DONE, mCasey.id);
  add("Fry Afternoon Batches", -13, "13:00", EntryStatus.DONE, mCasey.id);
  add(
    "Deep Clean Hatco (Hot Jam) Unit",
    -13,
    "14:30",
    EntryStatus.DONE,
    mCasey.id,
  );
  add("Close Shop Checklist", -13, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -12
  add(
    "Open Shop Checklist",
    -12,
    "06:00",
    EntryStatus.DONE,
    mBotMorningRunner.id,
  );
  add("Fry Morning Batches", -12, "07:00", EntryStatus.DONE, mCasey.id);
  add("Fryer Oil Quality Check", -12, "07:30", EntryStatus.DONE, mCasey.id);
  add("Prepare Chocolate Fondant", -12, "07:30", EntryStatus.DONE, mCasey.id);
  add(
    "Mid-Day Stock Check",
    -12,
    "12:00",
    EntryStatus.DONE,
    mBotCounterFloat.id,
  );
  add("Close Shop Checklist", -12, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -11
  add("Open Shop Checklist", -11, "06:00", EntryStatus.DONE, mAlex.id);
  add(
    "Fry Morning Batches",
    -11,
    "07:00",
    EntryStatus.DONE,
    mBotFryerBackup.id,
  );
  add(
    "Quality Check — Display & Products",
    -11,
    "10:00",
    EntryStatus.DONE,
    mRiley.id,
  );
  add("Close Shop Checklist", -11, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -10
  add("Open Shop Checklist", -10, "06:00", EntryStatus.DONE, mBotOpenSlot.id);
  add("Fry Morning Batches", -10, "07:00", EntryStatus.DONE, mCasey.id);
  add("Deep Clean All Fridges", -10, "14:00", EntryStatus.DONE, mRiley.id);
  add("Close Shop Checklist", -10, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -9
  add("Open Shop Checklist", -9, "06:00", EntryStatus.DONE, mJordan.id);
  add("Fry Morning Batches", -9, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Make Biscoff Filling", -9, "07:00", EntryStatus.DONE, mCasey.id);
  add("Fry Afternoon Batches", -9, "13:00", EntryStatus.DONE, mCasey.id);
  add("Clean Fryer (End of Day)", -9, "17:30", EntryStatus.DONE, mCasey.id);
  add("Close Shop Checklist", -9, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -8
  add(
    "Open Shop Checklist",
    -8,
    "06:00",
    EntryStatus.DONE,
    mBotMorningRunner.id,
  );
  add("Fry Morning Batches", -8, "07:00", EntryStatus.DONE, mCasey.id);
  add("Deep Clean Doughnut Display", -8, "15:00", EntryStatus.DONE, mJordan.id);
  add("Close Shop Checklist", -8, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -7
  add("Open Shop Checklist", -7, "06:00", EntryStatus.DONE, mAlex.id);
  add("Fry Morning Batches", -7, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add(
    "Fryer Oil Quality Check",
    -7,
    "07:30",
    EntryStatus.DONE,
    mBotFryerBackup.id,
  );
  add(
    "Mid-Day Stock Check",
    -7,
    "12:00",
    EntryStatus.DONE,
    mBotCounterFloat.id,
  );
  add("Shift Handover", -7, "13:00", EntryStatus.DONE, mRiley.id);
  add(
    "Close Shop Checklist",
    -7,
    "17:00",
    EntryStatus.SKIPPED,
    mBotWeekendFill.id,
  );

  // Day -6
  add("Open Shop Checklist", -6, "06:00", EntryStatus.DONE, mBotOpenSlot.id);
  add("Fry Morning Batches", -6, "07:00", EntryStatus.DONE, mCasey.id);
  add("Make Choc Custard Cream", -6, "06:45", EntryStatus.DONE, mCasey.id);
  add(
    "Clean Ice Cream Machine",
    -6,
    "14:00",
    EntryStatus.DONE,
    mBotCounterFloat.id,
  );
  add("Clean & Tidy Storeroom", -6, "15:00", EntryStatus.DONE, mRiley.id);
  add("Close Shop Checklist", -6, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -5
  add("Open Shop Checklist", -5, "06:00", EntryStatus.DONE, mJordan.id);
  add("Fry Morning Batches", -5, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Prepare Classic Glaze", -5, "07:30", EntryStatus.DONE, mCasey.id);
  add(
    "Quality Check — Display & Products",
    -5,
    "10:00",
    EntryStatus.DONE,
    mJordan.id,
  );
  add("Close Shop Checklist", -5, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -4
  add(
    "Open Shop Checklist",
    -4,
    "06:00",
    EntryStatus.DONE,
    mBotMorningRunner.id,
  );
  add("Fry Morning Batches", -4, "07:00", EntryStatus.DONE, mCasey.id);
  add("Fry Afternoon Batches", -4, "13:00", EntryStatus.DONE, mCasey.id);
  add(
    "Deep Clean Hatco (Hot Jam) Unit",
    -4,
    "14:30",
    EntryStatus.DONE,
    mCasey.id,
  );
  add("Close Shop Checklist", -4, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -3
  add("Open Shop Checklist", -3, "06:00", EntryStatus.DONE, mAlex.id);
  add("Fry Morning Batches", -3, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Make Custard Cream", -3, "06:30", EntryStatus.DONE, mCasey.id);
  add(
    "Restock Packaging & Supplies",
    -3,
    "11:00",
    EntryStatus.DONE,
    mBotMorningRunner.id,
  );
  add("Close Shop Checklist", -3, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -2
  add("Open Shop Checklist", -2, "06:00", EntryStatus.DONE, mBotOpenSlot.id);
  add("Fry Morning Batches", -2, "07:00", EntryStatus.DONE, mCasey.id);
  add("Fryer Oil Quality Check", -2, "07:30", EntryStatus.DONE, mCasey.id);
  add(
    "Mid-Day Stock Check",
    -2,
    "12:00",
    EntryStatus.DONE,
    mBotCounterFloat.id,
  );
  add("Clean Fryer (End of Day)", -2, "17:30", EntryStatus.DONE, mCasey.id);
  add("Close Shop Checklist", -2, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -1
  add("Open Shop Checklist", -1, "06:00", EntryStatus.DONE, mJordan.id);
  add("Fry Morning Batches", -1, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Make Nutella Filling", -1, "07:00", EntryStatus.DONE, mCasey.id);
  add("Prepare Biscoff Fondant", -1, "07:30", EntryStatus.DONE, mCasey.id);
  add(
    "Quality Check — Display & Products",
    -1,
    "10:00",
    EntryStatus.DONE,
    mRiley.id,
  );
  add("Close Shop Checklist", -1, "17:00", EntryStatus.DONE, mJordan.id);

  // ── Today ──────────────────────────────────────────────────────────────────
  add(
    "Open Shop Checklist",
    0,
    "06:00",
    EntryStatus.DONE,
    mBotMorningRunner.id,
  );
  add("Make Custard Cream", 0, "06:30", EntryStatus.DONE, mCasey.id);
  add("Fry Morning Batches", 0, "07:00", EntryStatus.IN_PROGRESS, mCasey.id);
  add("Fryer Oil Quality Check", 0, "07:30", EntryStatus.TODO, mCasey.id);
  add("Mid-Day Stock Check", 0, "12:00", EntryStatus.TODO, mBotCounterFloat.id);
  add("Shift Handover", 0, "13:00", EntryStatus.TODO, mJordan.id);
  add(
    "Fry Afternoon Batches",
    0,
    "13:00",
    EntryStatus.TODO,
    mBotFryerBackup.id,
  );
  add("Close Shop Checklist", 0, "17:00", EntryStatus.TODO, mRiley.id);

  // ── Future: Days +1 to +14 ─────────────────────────────────────────────────
  // +1
  add("Open Shop Checklist", 1, "06:00", EntryStatus.TODO, mJordan.id);
  add("Fry Morning Batches", 1, "07:00", EntryStatus.TODO, mBotFryerBackup.id);
  add("Make Biscoff Filling", 1, "07:00", EntryStatus.TODO, mCasey.id);
  add(
    "Quality Check — Display & Products",
    1,
    "10:00",
    EntryStatus.TODO,
    mRiley.id,
  );
  add("Close Shop Checklist", 1, "17:00", EntryStatus.TODO, mBotOpenSlot.id);

  // +2
  add(
    "Open Shop Checklist",
    2,
    "06:00",
    EntryStatus.TODO,
    mBotMorningRunner.id,
  );
  add("Fry Morning Batches", 2, "07:00", EntryStatus.TODO, mCasey.id);
  add("Prepare Classic Glaze", 2, "07:30", EntryStatus.TODO, mCasey.id);
  add("Mid-Day Stock Check", 2, "12:00", EntryStatus.TODO, mBotCounterFloat.id);
  add(
    "Clean Ice Cream Machine",
    2,
    "14:00",
    EntryStatus.TODO,
    mBotCounterFloat.id,
  );

  // +3
  add("Open Shop Checklist", 3, "06:00", EntryStatus.TODO, mAlex.id);
  add("Fry Morning Batches", 3, "07:00", EntryStatus.TODO, mBotFryerBackup.id);
  add(
    "Fryer Oil Quality Check",
    3,
    "07:30",
    EntryStatus.TODO,
    mBotFryerBackup.id,
  );
  add(
    "Deep Clean Hatco (Hot Jam) Unit",
    3,
    "14:30",
    EntryStatus.TODO,
    mCasey.id,
  );
  add("Close Shop Checklist", 3, "17:00", EntryStatus.TODO, mJordan.id);

  // +4
  add("Open Shop Checklist", 4, "06:00", EntryStatus.TODO, mBotOpenSlot.id);
  add("Fry Morning Batches", 4, "07:00", EntryStatus.TODO, mCasey.id);
  add("Make Choc Custard Cream", 4, "06:45", EntryStatus.TODO, mCasey.id);
  add(
    "Restock Packaging & Supplies",
    4,
    "11:00",
    EntryStatus.TODO,
    mBotMorningRunner.id,
  );
  add("Close Shop Checklist", 4, "17:00", EntryStatus.TODO, mRiley.id);

  // +5
  add("Open Shop Checklist", 5, "06:00", EntryStatus.TODO, mJordan.id);
  add("Fry Morning Batches", 5, "07:00", EntryStatus.TODO, mBotFryerBackup.id);
  add("Make Peanut Butter Filling", 5, "07:00", EntryStatus.TODO, mCasey.id);
  add("Fry Afternoon Batches", 5, "13:00", EntryStatus.TODO, mCasey.id);
  add("Deep Clean All Fridges", 5, "14:00", EntryStatus.TODO, mRiley.id);
  add("Close Shop Checklist", 5, "17:00", EntryStatus.TODO, mBotWeekendFill.id);

  // +6
  add(
    "Open Shop Checklist",
    6,
    "06:00",
    EntryStatus.TODO,
    mBotMorningRunner.id,
  );
  add("Fry Morning Batches", 6, "07:00", EntryStatus.TODO, mCasey.id);
  add("Deep Clean Doughnut Display", 6, "15:00", EntryStatus.TODO, mJordan.id);
  add("Clean & Tidy Storeroom", 6, "15:00", EntryStatus.TODO, mRiley.id);
  add("Close Shop Checklist", 6, "17:00", EntryStatus.TODO, mAlex.id);

  // +7
  add("Open Shop Checklist", 7, "06:00", EntryStatus.TODO, mBotOpenSlot.id);
  add("Fry Morning Batches", 7, "07:00", EntryStatus.TODO, mBotFryerBackup.id);
  add("Make Custard Cream", 7, "06:30", EntryStatus.TODO, mCasey.id);
  add("Fryer Oil Quality Check", 7, "07:30", EntryStatus.TODO, mCasey.id);
  add("Close Shop Checklist", 7, "17:00", EntryStatus.TODO, mJordan.id);

  // +8
  add("Open Shop Checklist", 8, "06:00", EntryStatus.TODO, mJordan.id);
  add("Fry Morning Batches", 8, "07:00", EntryStatus.TODO, mCasey.id);
  add("Prepare Biscoff Fondant", 8, "07:30", EntryStatus.TODO, mCasey.id);
  add(
    "Quality Check — Display & Products",
    8,
    "10:00",
    EntryStatus.TODO,
    mRiley.id,
  );
  add(
    "Clean Ice Cream Machine",
    8,
    "14:00",
    EntryStatus.TODO,
    mBotCounterFloat.id,
  );
  add("Close Shop Checklist", 8, "17:00", EntryStatus.TODO, mRiley.id);

  // +9
  add(
    "Open Shop Checklist",
    9,
    "06:00",
    EntryStatus.TODO,
    mBotMorningRunner.id,
  );
  add("Fry Morning Batches", 9, "07:00", EntryStatus.TODO, mBotFryerBackup.id);
  add("Mid-Day Stock Check", 9, "12:00", EntryStatus.TODO, mBotCounterFloat.id);
  add("Shift Handover", 9, "13:00", EntryStatus.TODO, mJordan.id);
  add("Close Shop Checklist", 9, "17:00", EntryStatus.TODO, mBotWeekendFill.id);

  // +10
  add("Open Shop Checklist", 10, "06:00", EntryStatus.TODO, mAlex.id);
  add("Fry Morning Batches", 10, "07:00", EntryStatus.TODO, mCasey.id);
  add(
    "Make Raspberry Cheesecake Filling",
    10,
    "07:00",
    EntryStatus.TODO,
    mCasey.id,
  );
  add(
    "Fry Afternoon Batches",
    10,
    "13:00",
    EntryStatus.TODO,
    mBotFryerBackup.id,
  );
  add("Close Shop Checklist", 10, "17:00", EntryStatus.TODO, mJordan.id);

  // +11
  add("Open Shop Checklist", 11, "06:00", EntryStatus.TODO, mBotOpenSlot.id);
  add("Fry Morning Batches", 11, "07:00", EntryStatus.TODO, mBotFryerBackup.id);
  add(
    "Fryer Oil Quality Check",
    11,
    "07:30",
    EntryStatus.TODO,
    mBotFryerBackup.id,
  );
  add(
    "Restock Packaging & Supplies",
    11,
    "11:00",
    EntryStatus.TODO,
    mBotMorningRunner.id,
  );
  add("Close Shop Checklist", 11, "17:00", EntryStatus.TODO, mRiley.id);

  // +12
  add("Open Shop Checklist", 12, "06:00", EntryStatus.TODO, mJordan.id);
  add("Fry Morning Batches", 12, "07:00", EntryStatus.TODO, mCasey.id);
  add("Clean Fryer (End of Day)", 12, "17:30", EntryStatus.TODO, mCasey.id);
  add("Close Shop Checklist", 12, "17:00", EntryStatus.TODO, mJordan.id);

  // +13
  add(
    "Open Shop Checklist",
    13,
    "06:00",
    EntryStatus.TODO,
    mBotMorningRunner.id,
  );
  add("Fry Morning Batches", 13, "07:00", EntryStatus.TODO, mBotFryerBackup.id);
  add(
    "Quality Check — Display & Products",
    13,
    "10:00",
    EntryStatus.TODO,
    mRiley.id,
  );
  add(
    "Deep Clean Hatco (Hot Jam) Unit",
    13,
    "14:30",
    EntryStatus.TODO,
    mCasey.id,
  );
  add("Close Shop Checklist", 13, "17:00", EntryStatus.TODO, mAlex.id);

  // +14
  add("Open Shop Checklist", 14, "06:00", EntryStatus.TODO, mBotOpenSlot.id);
  add("Fry Morning Batches", 14, "07:00", EntryStatus.TODO, mCasey.id);
  add("Make Custard Cream", 14, "06:30", EntryStatus.TODO, mCasey.id);
  add(
    "Fry Afternoon Batches",
    14,
    "13:00",
    EntryStatus.TODO,
    mBotFryerBackup.id,
  );
  add("Close Shop Checklist", 14, "17:00", EntryStatus.TODO, mRiley.id);

  const createdEntries = await prisma.timetableEntry.createManyAndReturn({
    data: entryData,
    select: { id: true, taskId: true, date: true, startTimeMin: true },
  });
  await prisma.timetableEntryAssignee.createMany({
    data: createdEntries.flatMap((e) => {
      const key = `${e.taskId}|${e.date.getTime()}|${e.startTimeMin}`;
      const membershipId = entryMembershipByKey.get(key);
      return membershipId ? [{ timetableEntryId: e.id, membershipId }] : [];
    }),
  });
  console.log(`  ✓ ${createdEntries.length} timetable entries created`);

  // ── Franchise Tokens ───────────────────────────────────────────────────────
  console.log("→ Creating franchise tokens...");
  const now = new Date();
  await prisma.franchiseToken.createMany({
    data: [
      {
        orgId: org.id,
        invitedEmail: "owner@downtown-donuts.com.au",
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      {
        orgId: org.id,
        invitedEmail: "franchise@northside-rings.com.au",
        expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days
      },
      {
        orgId: org.id,
        invitedEmail: "ops@southbay-donuts.com.au",
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days — expiring soon
      },
    ],
  });
  console.log("  ✓ 3 franchise tokens created");

  // ── Roster Day Config ──────────────────────────────────────────────────────
  console.log("→ Creating roster day configs...");
  await prisma.rosterDayConfig.createMany({
    data: [
      {
        orgId: org.id,
        dayIndex: 0,
        recommendedSize: 3,
        openTimeMin: 360,
        closeTimeMin: 1080,
      },
      {
        orgId: org.id,
        dayIndex: 1,
        recommendedSize: 4,
        openTimeMin: 360,
        closeTimeMin: 1080,
      },
      {
        orgId: org.id,
        dayIndex: 2,
        recommendedSize: 4,
        openTimeMin: 360,
        closeTimeMin: 1080,
      },
      {
        orgId: org.id,
        dayIndex: 3,
        recommendedSize: 3,
        openTimeMin: 360,
        closeTimeMin: 1080,
      },
      {
        orgId: org.id,
        dayIndex: 4,
        recommendedSize: 5,
        openTimeMin: 360,
        closeTimeMin: 1080,
      },
      {
        orgId: org.id,
        dayIndex: 5,
        recommendedSize: 5,
        openTimeMin: 420,
        closeTimeMin: 1080,
      },
      {
        orgId: org.id,
        dayIndex: 6,
        recommendedSize: 4,
        openTimeMin: 420,
        closeTimeMin: 1020,
      },
    ],
    skipDuplicates: true,
  });
  console.log("  ✓ 7 roster day configs created");

  // ── Roster Template ────────────────────────────────────────────────────────
  console.log("→ Creating roster template...");
  const rosterTemplate = await prisma.rosterTemplate.create({
    data: { orgId: org.id, name: "Standard Week", cycleWeeks: 1 },
  });
  await prisma.rosterTemplateEntry.createMany({
    data: [
      // Ivan — Mon–Fri 06:00–14:00
      {
        templateId: rosterTemplate.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 0,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 4,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      // Jordan — Mon–Fri 06:00–14:00
      {
        templateId: rosterTemplate.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 0,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 4,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      // Casey — Tue–Sat 06:00–15:00
      {
        templateId: rosterTemplate.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 4,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 5,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      // Riley — Mon/Wed/Fri/Sat 10:00–18:00
      {
        templateId: rosterTemplate.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 0,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 2,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 4,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 5,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      // Alex — Tue/Thu/Sat/Sun 12:00–18:00
      {
        templateId: rosterTemplate.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 1,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 3,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 5,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 6,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },
    ],
    skipDuplicates: true,
  });
  console.log("  ✓ Roster template + entries created");

  // ── Roster Entries (3 weeks) ───────────────────────────────────────────────
  console.log("→ Creating roster entries...");
  const weekPrev = getMondayUTC(-1);
  const weekCurr = getMondayUTC(0);
  const weekNext = getMondayUTC(1);
  await prisma.rosterEntry.createMany({
    data: [
      // ── Previous week ───────────────────────────────────────────────────────
      // Ivan Mon–Fri 06:00–14:00
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 0,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 4,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      // Jordan Mon–Fri 06:00–14:00 (Wed: late start note)
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 0,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 2,
        shiftStartMin: 450,
        shiftEndMin: 840,
        note: "Late start — fryer issue",
      },
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 4,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      // Casey Tue–Sat 06:00–15:00
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 4,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 5,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      // Riley Mon/Wed/Fri/Sat 10:00–18:00 (Sat: double split note)
      {
        orgId: org.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 0,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 2,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 4,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 5,
        shiftStartMin: 600,
        shiftEndMin: 1080,
        note: "Busy Sat — double split",
      },
      // Alex Tue/Thu/Sat/Sun 12:00–18:00
      {
        orgId: org.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 1,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 3,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 5,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 6,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },

      // ── Current week ─────────────────────────────────────────────────────────
      // Ivan Mon–Fri 06:00–14:00
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 0,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 4,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      // Jordan Mon–Fri 06:00–14:00
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 0,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 4,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      // Casey Tue–Sat 06:00–15:00 (Sat: public holiday coverage)
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 4,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 5,
        shiftStartMin: 360,
        shiftEndMin: 900,
        note: "Public holiday coverage",
      },
      // Riley Mon/Wed/Fri/Sat 10:00–18:00
      {
        orgId: org.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 0,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 2,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 4,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 5,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      // Alex Tue/Thu/Sat/Sun 12:00–18:00
      {
        orgId: org.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 1,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 3,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 5,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 6,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },

      // ── Next week ─────────────────────────────────────────────────────────────
      // Ivan Mon–Fri 06:00–14:00
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 0,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: _mOwner.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 4,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      // Jordan Mon–Fri 06:00–14:00 (Thu: management meeting)
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 0,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 3,
        shiftStartMin: 600,
        shiftEndMin: 840,
        note: "Management meeting AM",
      },
      {
        orgId: org.id,
        membershipId: mJordan.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 4,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      // Casey Tue–Sat 06:00–15:00
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 4,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      {
        orgId: org.id,
        membershipId: mCasey.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 5,
        shiftStartMin: 360,
        shiftEndMin: 900,
      },
      // Riley Mon/Wed/Fri/Sat 10:00–18:00
      {
        orgId: org.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 0,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 2,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 4,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mRiley.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 5,
        shiftStartMin: 600,
        shiftEndMin: 1080,
      },
      // Alex Tue/Thu/Sat/Sun 12:00–18:00
      {
        orgId: org.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 1,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 3,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 5,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },
      {
        orgId: org.id,
        membershipId: mAlex.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 6,
        shiftStartMin: 720,
        shiftEndMin: 1080,
      },
    ],
    skipDuplicates: true,
  });
  console.log("  ✓ Roster entries created (3 weeks)");

  // ── Tool Items ─────────────────────────────────────────────────────────────
  console.log("→ Creating tool items...");
  const _toolItems = await prisma.toolItem.createManyAndReturn({
    data: [
      { orgId: org.id, name: "Dough Rings",         unit: "each"   },
      { orgId: org.id, name: "Custard Powder",       unit: "g"      },
      { orgId: org.id, name: "Cold Water",           unit: "ml"     },
      { orgId: org.id, name: "Whipping Cream",       unit: "ml"     },
      { orgId: org.id, name: "Biscoff Spread",       unit: "g"      },
      { orgId: org.id, name: "Vegetable Oil",        unit: "ml"     },
      { orgId: org.id, name: "Nutella",              unit: "g"      },
      { orgId: org.id, name: "Peanut Butter",        unit: "g"      },
      { orgId: org.id, name: "Icing Sugar",          unit: "g"      },
      { orgId: org.id, name: "White Fondant",        unit: "g"      },
      { orgId: org.id, name: "Butter",               unit: "g"      },
      { orgId: org.id, name: "Chocolate Buttons",    unit: "g"      },
      { orgId: org.id, name: "Cocoa Powder",         unit: "g"      },
      { orgId: org.id, name: "Hot Water",            unit: "ml"     },
      { orgId: org.id, name: "Chocolate Powder",     unit: "scoops" },
      { orgId: org.id, name: "Quark",                unit: "g"      },
    ],
  });
  const _tiByName = Object.fromEntries(_toolItems.map((ti) => [ti.name, ti]));
  const tiDoughRings    = _tiByName["Dough Rings"]!;
  const tiCustardPowder = _tiByName["Custard Powder"]!;
  const tiColdWater     = _tiByName["Cold Water"]!;
  const tiWhippingCream = _tiByName["Whipping Cream"]!;
  const tiBiscoffSpread = _tiByName["Biscoff Spread"]!;
  const tiWhiteFondant  = _tiByName["White Fondant"]!;
  const tiButter        = _tiByName["Butter"]!;
  const tiChocButtons   = _tiByName["Chocolate Buttons"]!;
  const tiCocoaPowder   = _tiByName["Cocoa Powder"]!;
  const tiHotWater      = _tiByName["Hot Water"]!;
  const tiChocPowder    = _tiByName["Chocolate Powder"]!;
  console.log("  ✓ 16 tool items created");

  // ── Conversion Sets ────────────────────────────────────────────────────────
  console.log("→ Creating conversion sets...");

  // — Custard Cream Batch —
  const setCustardCream = await prisma.conversionSet.create({
    data: { orgId: org.id, name: "Custard Cream Batch" },
  });
  await prisma.conversionRate.createMany({
    data: [
      // Recipe: 1250g Custard Powder + 2500ml Cold Water + 5000ml Whipping Cream ≈ 215 rings
      {
        setId: setCustardCream.id,
        fromItemId: tiDoughRings.id,
        toItemId: tiCustardPowder.id,
        fromQty: 215,
        toQty: 1250,
      },
      {
        setId: setCustardCream.id,
        fromItemId: tiDoughRings.id,
        toItemId: tiColdWater.id,
        fromQty: 215,
        toQty: 2500,
      },
      {
        setId: setCustardCream.id,
        fromItemId: tiDoughRings.id,
        toItemId: tiWhippingCream.id,
        fromQty: 215,
        toQty: 5000,
      },
      // Choc upgrade: per 40 rings ≈ 10 scoops chocolate powder
      {
        setId: setCustardCream.id,
        fromItemId: tiDoughRings.id,
        toItemId: tiChocPowder.id,
        fromQty: 40,
        toQty: 10,
      },
    ],
    skipDuplicates: true,
  });
  const [tplStandardDay, tplQuietDay] = await Promise.all([
    prisma.conversionTemplate.create({
      data: { setId: setCustardCream.id, name: "Standard Day — 200 rings" },
    }),
    prisma.conversionTemplate.create({
      data: { setId: setCustardCream.id, name: "Quiet Day — 150 rings" },
    }),
  ]);
  await prisma.conversionTemplateEntry.createMany({
    data: [
      { templateId: tplStandardDay.id, itemId: tiDoughRings.id, quantity: 200 },
      { templateId: tplQuietDay.id, itemId: tiDoughRings.id, quantity: 150 },
    ],
    skipDuplicates: true,
  });

  // — Chocolate Fondant Batch —
  const setChocFondant = await prisma.conversionSet.create({
    data: { orgId: org.id, name: "Chocolate Fondant Batch" },
  });
  await prisma.conversionRate.createMany({
    data: [
      // Recipe per 1000g White Fondant
      {
        setId: setChocFondant.id,
        fromItemId: tiWhiteFondant.id,
        toItemId: tiButter.id,
        fromQty: 1000,
        toQty: 100,
      },
      {
        setId: setChocFondant.id,
        fromItemId: tiWhiteFondant.id,
        toItemId: tiChocButtons.id,
        fromQty: 1000,
        toQty: 200,
      },
      {
        setId: setChocFondant.id,
        fromItemId: tiWhiteFondant.id,
        toItemId: tiCocoaPowder.id,
        fromQty: 1000,
        toQty: 60,
      },
      {
        setId: setChocFondant.id,
        fromItemId: tiWhiteFondant.id,
        toItemId: tiHotWater.id,
        fromQty: 1000,
        toQty: 60,
      },
    ],
    skipDuplicates: true,
  });
  const tplSingleChoc = await prisma.conversionTemplate.create({
    data: { setId: setChocFondant.id, name: "Single Choc Fondant Batch" },
  });
  await prisma.conversionTemplateEntry.create({
    data: {
      templateId: tplSingleChoc.id,
      itemId: tiWhiteFondant.id,
      quantity: 1000,
    },
  });

  // — Biscoff Fondant Batch —
  const setBiscoffFondant = await prisma.conversionSet.create({
    data: { orgId: org.id, name: "Biscoff Fondant Batch" },
  });
  await prisma.conversionRate.create({
    data: {
      setId: setBiscoffFondant.id,
      fromItemId: tiWhiteFondant.id,
      toItemId: tiBiscoffSpread.id,
      fromQty: 1000,
      toQty: 200,
    },
  });
  const tplSingleBiscoff = await prisma.conversionTemplate.create({
    data: { setId: setBiscoffFondant.id, name: "Single Biscoff Fondant Batch" },
  });
  await prisma.conversionTemplateEntry.create({
    data: {
      templateId: tplSingleBiscoff.id,
      itemId: tiWhiteFondant.id,
      quantity: 1000,
    },
  });
  console.log("  ✓ 3 conversion sets + rates + templates created");

  return {
    org,
    roles: { roleOwner, roleWorker, roleFryer, roleCounter },
    botOpenSlot: mBotOpenSlot,
  };
}

export function registerDonutShopASeeds(plan: SeedPlan) {
  plan.orgs.push(seedDonutShopA);
}