import { PrismaClient, PermissionAction } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/rbac";
import type { SeedPlan } from "../seed-plan";
import { ALL_OWNER_PERMISSIONS } from "../helpers";
import type { Users } from "../users";

// ─────────────────────────────────────────────────────────────────────────────
// 5. EMPTY ORGS — multiple orgs with Riley as a member (not owner)
//    Owner: Jordan  |  Member: Riley
// ─────────────────────────────────────────────────────────────────────────────

export async function seedEmptyOrgs(prisma: PrismaClient, users: Users) {
  const { jordan, riley } = users;

  const orgDefs = [
    { name: "Coffee House B",  address: "10 George Street, Sydney NSW 2000",       timezone: "Australia/Sydney"    },
    { name: "Bakery Co C",     address: "55 Collins Street, Melbourne VIC 3000",    timezone: "Australia/Melbourne" },
    { name: "Pie Shop D",      address: "78 Queen Street, Brisbane QLD 4000",       timezone: "Australia/Brisbane"  },
    { name: "Burger Joint E",  address: "22 Rundle Mall, Adelaide SA 5000",         timezone: "Australia/Adelaide"  },
    { name: "Noodle Bar F",    address: "99 Murray Street, Perth WA 6000",          timezone: "Australia/Perth"     },
  ];

  console.log(`→ Creating ${orgDefs.length} empty orgs...`);
  for (const def of orgDefs) {
    const org = await prisma.organization.create({
      data: {
        name: def.name,
        ownerId: jordan.id,
        address: def.address,
        timezone: def.timezone,
        operatingDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      },
    });

    const [roleOwner, roleWorker] = await prisma.role
      .createManyAndReturn({
        data: [
          { orgId: org.id, name: "Owner",          key: ROLE_KEYS.OWNER,          color: "#ef4444", isDeletable: false, isDefault: false },
          { orgId: org.id, name: "Default Member", key: ROLE_KEYS.DEFAULT_MEMBER, color: "#6b7280", isDeletable: false, isDefault: true  },
        ],
      })
      .then((rows) => [
        rows.find((r) => r.key === ROLE_KEYS.OWNER)!,
        rows.find((r) => r.key === ROLE_KEYS.DEFAULT_MEMBER)!,
      ] as const);

    await prisma.permission.createMany({
      data: [
        ...ALL_OWNER_PERMISSIONS.map((action) => ({ roleId: roleOwner.id, action })),
        { roleId: roleWorker.id, action: PermissionAction.VIEW_TIMETABLE },
      ],
      skipDuplicates: true,
    });

    const _memberships = await prisma.membership.createManyAndReturn({
      data: [
        { orgId: org.id, userId: jordan.id, workingDays: ["mon", "tue", "wed", "thu", "fri"] },
        { orgId: org.id, userId: riley.id,   workingDays: ["mon", "tue", "wed", "thu", "fri"] },
      ],
    });
    const mJordan = _memberships.find((m) => m.userId === jordan.id)!;
    const mRiley  = _memberships.find((m) => m.userId === riley.id)!;

    await prisma.memberRole.createMany({
      data: [
        { membershipId: mJordan.id, roleId: roleOwner.id  },
        { membershipId: mRiley.id,   roleId: roleWorker.id },
      ],
    });

    console.log(`  ✓ ${org.name}`);
  }
}

export function registerEmptyOrgSeeds(plan: SeedPlan) {
  plan.afterOrg.push(seedEmptyOrgs);
}