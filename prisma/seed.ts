import {
  PrismaClient,
  OrgPermission,
  TaskInstanceStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ROLE_KEYS } from "@/lib/rbac";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function timeToMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

async function main() {
  // Clean in dependency-safe order (dev seed convenience)
  await prisma.taskInstanceAssignee.deleteMany();
  await prisma.taskInstance.deleteMany();
  await prisma.taskEligibility.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.timetableTemplate.deleteMany();
  await prisma.task.deleteMany();
  await prisma.role.deleteMany();
  await prisma.organization.deleteMany(); // must precede user (ownerUserId FK)
  await prisma.user.deleteMany();

  // Users
  const ownerUser = await prisma.user.create({
    data: {
      name: "Ivan",
      email: "mystoganx2001@gmail.com",
    },
  });

  const [worker1, worker2, worker3, worker4] = await Promise.all([
    prisma.user.create({
      data: { name: "Jordan", email: "alt28918@gmail.com" },
    }),
    prisma.user.create({
      data: { name: "Casey", email: "alt28919@gmail.com" },
    }),
    prisma.user.create({
      data: { name: "Riley", email: "alt28920@gmail.com" },
    }),
    prisma.user.create({
      data: { name: "Morgan", email: "alt28921@gmail.com" },
    }),
  ]);

  // Org
  const org = await prisma.organization.create({
    data: {
      title: "Donut Shop A",
      ownerUserId: ownerUser.id,
      openTimeMin: timeToMin("06:00"),
      closeTimeMin: timeToMin("18:00"),
      timezone: "Australia/Sydney",
    },
  });

  // Roles
  const ownerRole = await prisma.role.create({
    data: {
      orgId: org.id,
      title: "Owner",
      key: "owner",
    },
  });

  const workerRole = await prisma.role.create({
    data: {
      orgId: org.id,
      title: "Worker",
      key: ROLE_KEYS.DEFAULT_MEMBER,
    },
  });

  // Owner permissions (full access)
  await prisma.rolePermission.createMany({
    data: [
      { roleId: ownerRole.id, permission: OrgPermission.ORG_MANAGE },
      { roleId: ownerRole.id, permission: OrgPermission.ROLE_MANAGE },
      { roleId: ownerRole.id, permission: OrgPermission.TASK_CREATE },
      { roleId: ownerRole.id, permission: OrgPermission.TASK_UPDATE },
      { roleId: ownerRole.id, permission: OrgPermission.TASK_DELETE },
      { roleId: ownerRole.id, permission: OrgPermission.TASK_ASSIGN },
      { roleId: ownerRole.id, permission: OrgPermission.TASKINSTANCE_COMPLETE },
    ],
    skipDuplicates: true,
  });

  // Worker permissions (can complete tasks assigned to them)
  await prisma.rolePermission.createMany({
    data: [
      {
        roleId: workerRole.id,
        permission: OrgPermission.TASKINSTANCE_COMPLETE,
      },
    ],
    skipDuplicates: true,
  });

  // Memberships
  const ownerMembership = await prisma.membership.create({
    data: { orgId: org.id, userId: ownerUser.id, roleId: ownerRole.id },
  });

  const [mem1, mem2, mem3, mem4] = await Promise.all([
    prisma.membership.create({
      data: { orgId: org.id, userId: worker1.id, roleId: workerRole.id },
    }),
    prisma.membership.create({
      data: { orgId: org.id, userId: worker2.id, roleId: workerRole.id },
    }),
    prisma.membership.create({
      data: { orgId: org.id, userId: worker3.id, roleId: workerRole.id },
    }),
    prisma.membership.create({
      data: { orgId: org.id, userId: worker4.id, roleId: workerRole.id },
    }),
  ]);

  // Tasks
  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        orgId: org.id,
        title: "Open shop checklist",
        description: "Turn on lights, start fryer, prep counter.",
        durationMin: 30,
        preferredStartTimeMin: timeToMin("06:00"),
        peopleRequired: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org.id,
        title: "Clean ice cream machine",
        description: "Full sanitize cycle.",
        durationMin: 45,
        preferredStartTimeMin: timeToMin("14:00"),
        peopleRequired: 1,
        minWaitDays: 2,
        maxWaitDays: 3,
      },
    }),
    prisma.task.create({
      data: {
        orgId: org.id,
        title: "Close shop checklist",
        description: "Trash, mop, lock up, end of day report.",
        durationMin: 40,
        preferredStartTimeMin: timeToMin("17:00"),
        peopleRequired: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
      },
    }),
  ]);

  // Eligibility: let Worker do all tasks
  await prisma.taskEligibility.createMany({
    data: tasks.map((t) => ({
      taskId: t.id,
      roleId: workerRole.id,
    })),
    skipDuplicates: true,
  });

  // Timetable template
  const template = await prisma.timetableTemplate.create({
    data: {
      orgId: org.id,
      title: "Week 1",
      templateDays: 7,
    },
  });

  // Template instances — positions are cycle-relative (dayOffset + startTimeMin)
  const instance1 = await prisma.taskInstance.create({
    data: {
      orgId: org.id,
      taskId: tasks[0].id,
      templateId: template.id,
      status: TaskInstanceStatus.TODO,
      dayOffset: 1,
      startTimeMin: timeToMin("06:00"),
      assignees: {
        create: [{ membershipId: mem1.id }, { membershipId: mem2.id }],
      },
    },
  });

  const instance2 = await prisma.taskInstance.create({
    data: {
      orgId: org.id,
      taskId: tasks[1].id,
      templateId: template.id,
      status: TaskInstanceStatus.TODO,
      dayOffset: 3,
      startTimeMin: timeToMin("14:00"),
      assignees: {
        create: [{ membershipId: mem3.id }],
      },
    },
  });

  const instance3 = await prisma.taskInstance.create({
    data: {
      orgId: org.id,
      taskId: tasks[2].id,
      templateId: template.id,
      status: TaskInstanceStatus.TODO,
      dayOffset: 7,
      startTimeMin: timeToMin("17:00"),
      assignees: {
        create: [{ membershipId: mem4.id }],
      },
    },
  });

  // Live scheduled instances (this week, no template — shown on timetable calendar)
  // Build dates in the org timezone (Australia/Sydney) so seeded timestamps are
  // consistent regardless of the machine running the seed.
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
  const mondayLocal = new Date(Date.UTC(ty, tm - 1, td + (DOW[localWd] ?? 0)))
    .toISOString()
    .split("T")[0];

  /** Returns a UTC Date representing `hhmm` local time on Monday + dayIndex in the org timezone. */
  const atTime = (dayIndex: number, hhmm: string): Date => {
    const [my, mm, md] = mondayLocal.split("-").map(Number);
    const [h, min] = hhmm.split(":").map(Number);
    const dateStr = new Date(Date.UTC(my, mm - 1, md + dayIndex))
      .toISOString()
      .split("T")[0];
    // Find UTC offset for that date at noon to handle DST
    const noon = Date.UTC(
      ...(dateStr.split("-").map(Number) as [number, number, number]),
      12,
    );
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: ORG_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .formatToParts(new Date(noon))
        .map((p) => [p.type, p.value]),
    );
    const lH = parseInt(parts.hour ?? "0") % 24;
    const lM = parseInt(parts.minute ?? "0");
    const midnightUTC = noon - ((lH * 60 + lM) * 60 * 1000 - 12 * 3_600_000);
    return new Date(midnightUTC + (h * 60 + min) * 60 * 1000);
  };

  const live1 = await prisma.taskInstance.create({
    data: {
      orgId: org.id,
      taskId: tasks[0].id,
      status: TaskInstanceStatus.TODO,
      scheduledStartAt: atTime(0, "06:00"),
      scheduledEndAt: atTime(0, "06:30"),
      assignees: { create: [{ membershipId: mem1.id }] },
    },
  });

  const live2 = await prisma.taskInstance.create({
    data: {
      orgId: org.id,
      taskId: tasks[1].id,
      status: TaskInstanceStatus.IN_PROGRESS,
      scheduledStartAt: atTime(2, "14:00"),
      scheduledEndAt: atTime(2, "14:45"),
      assignees: { create: [{ membershipId: mem3.id }] },
    },
  });

  const live3 = await prisma.taskInstance.create({
    data: {
      orgId: org.id,
      taskId: tasks[2].id,
      status: TaskInstanceStatus.TODO,
      scheduledStartAt: atTime(4, "17:00"),
      scheduledEndAt: atTime(4, "17:40"),
      assignees: { create: [{ membershipId: mem4.id }] },
    },
  });

  console.log("Seeded successfully:");
  console.log({
    orgId: org.id,
    ownerUserId: ownerUser.id,
    workerUserIds: [worker1.id, worker2.id, worker3.id, worker4.id],
    ownerMembershipId: ownerMembership.id,
    workerMembershipIds: [mem1.id, mem2.id, mem3.id, mem4.id],
    roleIds: { ownerRoleId: ownerRole.id, workerRoleId: workerRole.id },
    taskIds: tasks.map((t) => t.id),
    templateId: template.id,
    templateInstanceIds: [instance1.id, instance2.id, instance3.id],
    liveInstanceIds: [live1.id, live2.id, live3.id],
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
