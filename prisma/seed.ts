import {
  PrismaClient,
  OrgPermission,
  TaskInstanceStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

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
  await prisma.taskCycle.deleteMany();
  await prisma.task.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Users
  const ownerUser = await prisma.user.create({
    data: {
      name: "Ivan Owner",
      email: "owner@example.com",
    },
  });

  const workerUser = await prisma.user.create({
    data: {
      name: "Wendy Worker",
      email: "worker@example.com",
    },
  });

  // Org
  const org = await prisma.organization.create({
    data: {
      title: "Donut Shop A",
      ownerUserId: ownerUser.id,
      openTimeMin: timeToMin("06:00"),
      closeTimeMin: timeToMin("18:00"),
    },
  });

  // Roles
  const ownerRole = await prisma.role.create({
    data: {
      orgId: org.id,
      title: "Owner",
    },
  });

  const workerRole = await prisma.role.create({
    data: {
      orgId: org.id,
      title: "Worker",
    },
  });

  // Owner permissions (adjust however you want)
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

  // Memberships
  const ownerMembership = await prisma.membership.create({
    data: {
      orgId: org.id,
      userId: ownerUser.id,
      roleId: ownerRole.id,
    },
  });

  const workerMembership = await prisma.membership.create({
    data: {
      orgId: org.id,
      userId: workerUser.id,
      roleId: workerRole.id,
    },
  });

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

  // Eligibility: let Worker do all tasks (example)
  await prisma.taskEligibility.createMany({
    data: tasks.map((t) => ({
      orgId: org.id,
      taskId: t.id,
      roleId: workerRole.id,
    })),
    skipDuplicates: true,
  });

  // Cycle
  const cycle = await prisma.taskCycle.create({
    data: {
      orgId: org.id,
      cycleDays: 7,
    },
  });

  // Instances (example)
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const instance1 = await prisma.taskInstance.create({
    data: {
      orgId: org.id,
      taskId: tasks[0].id,
      cycleId: cycle.id,
      status: TaskInstanceStatus.TODO,
      scheduledStartAt: inOneHour,
      scheduledEndAt: inTwoHours,
      assignees: {
        create: [{ membershipId: workerMembership.id }],
      },
    },
  });

  const instance2 = await prisma.taskInstance.create({
    data: {
      orgId: org.id,
      taskId: tasks[1].id,
      cycleId: cycle.id,
      status: TaskInstanceStatus.TODO,
      assignees: {
        create: [{ membershipId: workerMembership.id }],
      },
    },
  });

  console.log("Seeded successfully:");
  console.log({
    orgId: org.id,
    ownerUserId: ownerUser.id,
    workerUserId: workerUser.id,
    ownerMembershipId: ownerMembership.id,
    workerMembershipId: workerMembership.id,
    roleIds: { ownerRoleId: ownerRole.id, workerRoleId: workerRole.id },
    taskIds: tasks.map((t) => t.id),
    cycleId: cycle.id,
    instanceIds: [instance1.id, instance2.id],
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
