/**
 * Seed script for Donut Shop A.
 *
 * Creates (or resets) the "Donut Shop A" org owned by Ivan, with:
 *   - 5 real members  (Ivan, Jordan, Casey, Riley, Alex)
 *   - 5 bot slots     (Open Slot, Morning Runner, Fryer Backup, Counter Float, Weekend Fill)
 *   - Rich RBAC       (Owner, Default Member, Fryer Operator, Counter Staff, Shift Lead, Trainee)
 *   - 30+ tasks       (operations + recipe cards)
 *   - 3 templates
 *   - Dense timetable (30 days past + 14 days future)
 *   - 3 franchise tokens (pending invites to franchisee orgs)
 *
 * Safe to re-run — uses --reset to wipe and recreate.
 *
 * Run with:
 *   npx tsx private/seed-donut-shop-a.ts
 *   npx tsx private/seed-donut-shop-a.ts --reset
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });

import { PrismaClient, PermissionAction, EntryStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ROLE_KEYS } from "@/lib/rbac";
import { localToUTC } from "@/lib/date-utils";

const dbUrl = process.env.DATABASE_URL!;
if (!dbUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

const ALL_OWNER_PERMISSIONS = Object.values(PermissionAction);

function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

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

// ─── Tasks ───────────────────────────────────────────────────────────────────
// [name, color, durationMin, description, role_key, preferredStart, minWait, maxWait]

type TaskDef = [string, string, number, string, string, string, number, number];

const TASKS: TaskDef[] = [
  // ── Daily Operations ─────────────────────────────────────────────────────
  [
    "Open Shop Checklist",
    "#F59E0B",
    30,
    "**Steps**\n1. Unlock front door and disable alarm.\n2. Turn on all lights and display cases.\n3. Power on fryer and preheat to 180°C.\n4. Set up POS terminal and float.\n5. Wipe down all counters and restock condiments.\n6. Check doughnut display stock levels and fill from overnight tray.\n7. Log opening time in shift register.",
    "counter_staff",
    "06:00",
    0,
    1,
  ],
  [
    "Close Shop Checklist",
    "#8B5CF6",
    45,
    "**Steps**\n1. Count and reconcile till. Record figures in shift register.\n2. Remove and label any remaining doughnuts for next-day staff meal.\n3. Turn off fryer — allow 30 min cool-down before cleaning.\n4. Wipe all surfaces, displays, and equipment exteriors.\n5. Mop floor (front of house and kitchen).\n6. Empty bins and replace liners.\n7. Set alarm and lock up.",
    "shift_lead",
    "17:00",
    0,
    1,
  ],
  [
    "Mid-Day Stock Check",
    "#22C55E",
    20,
    "**Steps**\n1. Count remaining doughnuts per flavour in display.\n2. Check frappe/shake ingredient levels (milk, ice, syrups, powders).\n3. Note any items running low and flag to manager.\n4. Restock from cool room as needed.\n5. Record stock status in the shift log.",
    "counter_staff",
    "12:00",
    0,
    1,
  ],
  [
    "Restock Packaging & Supplies",
    "#10B981",
    25,
    "**Check and restock:**\n• Doughnut boxes (individual, 6-pack, 12-pack)\n• Bags and tissue paper\n• Cups (8oz, 12oz, 16oz, 22oz)\n• Dome lids, flat lids, straw lids\n• Straws and soda spoons\n• Napkins\n• POS receipt paper\n\n_Reorder alert threshold: less than 1 full case of any item._",
    "counter_staff",
    "11:00",
    1,
    3,
  ],
  [
    "Fryer Oil Quality Check",
    "#EF4444",
    15,
    "**Steps**\n1. Check oil colour using test strip — replace if reading is above 25 TPM.\n2. Check oil level — top up if below fill line.\n3. Skim any debris from surface.\n4. Record result in equipment log.\n\n_Oil should be replaced every 3–4 days under normal volume. Do not fry in degraded oil._",
    "fryer_op",
    "07:30",
    0,
    2,
  ],
  [
    "Fry Morning Batches",
    "#EF4444",
    60,
    "**Steps**\n1. Confirm fryer is at 180°C.\n2. Remove proofed doughs from proofer.\n3. Lower rack gently — fry 90 sec each side.\n4. Drain on wire rack for 2 min.\n5. Cool completely before filling or glazing (min 20 min).\n6. Record batch count and any waste in production log.\n\n_Never overload the fryer — max 6 rings per side._",
    "fryer_op",
    "07:00",
    0,
    1,
  ],
  [
    "Fry Afternoon Batches",
    "#EF4444",
    45,
    "**Steps**\n1. Confirm fryer is still at 180°C (reheat if needed, 10 min).\n2. Fry top-up batches for afternoon/evening rush.\n3. Drain, cool, and pass to decorating station.\n4. Record batch count in production log.",
    "fryer_op",
    "13:00",
    0,
    1,
  ],
  [
    "Clean Fryer (End of Day)",
    "#EF4444",
    40,
    "**Steps**\n1. Allow oil to cool to below 50°C (check with probe).\n2. Drain oil into storage container — label with date.\n3. Wipe interior with paper towels.\n4. Fill with water + commercial fryer cleaner solution.\n5. Boil-out for 20 min.\n6. Drain, rinse twice with clean water.\n7. Dry thoroughly and reassemble.\n8. Record in equipment cleaning log.",
    "fryer_op",
    "17:30",
    0,
    1,
  ],
  [
    "Quality Check — Display & Products",
    "#A855F7",
    20,
    "**Steps**\n1. Inspect all displayed doughnuts — remove any that are stale, cracked, or poorly decorated.\n2. Check toppings are secure and glazes have set properly.\n3. Verify labels and allergen tags are correct.\n4. Taste test 1 item per flavour family (rotating schedule).\n5. Log any quality issues with photo if possible.",
    "shift_lead",
    "10:00",
    0,
    2,
  ],
  [
    "Shift Handover",
    "#64748B",
    15,
    "**Outgoing staff must:**\n1. Brief incoming staff on any ongoing issues.\n2. Note remaining stock levels verbally and in shift register.\n3. Flag any equipment issues or customer complaints.\n4. Hand over keys/float if applicable.\n5. Sign off shift register.",
    "shift_lead",
    "13:00",
    0,
    1,
  ],

  // ── Prep: Fillings ────────────────────────────────────────────────────────
  [
    "Make Custard Cream",
    "#F59E0B",
    30,
    "**Ingredients**\n• 1250g Custard Powder\n• 2500ml Cold Water\n• 5000ml Cream\n\n**Method**\n1. Whisk cream and water together until combined.\n2. Fold in custard powder until smooth peaks form.\n\n_Makes approx. 8.75kg — enough for 215+ doughnuts. Should be light and fluffy, not dense._",
    "fryer_op",
    "06:30",
    0,
    1,
  ],
  [
    "Make Choc Custard Cream",
    "#F59E0B",
    20,
    "**Per 1kg Custard Cream:**\n• 10x small scoops Chocolate Powder\n\n**Method**\n1. Add Chocolate Powder to prepared Custard Cream.\n2. Mix thoroughly until fully incorporated.",
    "fryer_op",
    "06:45",
    0,
    1,
  ],
  [
    "Make Biscoff Filling",
    "#F59E0B",
    15,
    "**Ingredients**\n• 1000g Biscoff Spread\n• 40g Vegetable Oil\n\n**Method**\n1. Combine Biscoff and Vegetable Oil.\n2. Mix thoroughly.\n\n_Wet scoop with water before measuring Biscoff. Adding 4% Vegetable Oil ensures a workable consistency for filling._",
    "fryer_op",
    "07:00",
    0,
    2,
  ],
  [
    "Make Raspberry Cheesecake Filling",
    "#F59E0B",
    20,
    "**Per 1kg Custard Cream:**\n• 50g Quark\n• 2x small scoops crushed Freeze Dried Raspberries\n\n**Method**\n1. Add Quark and raspberries to prepared Custard Cream.\n2. Mix thoroughly.",
    "fryer_op",
    "07:00",
    0,
    2,
  ],
  [
    "Make Nutella Filling",
    "#F59E0B",
    15,
    "**Ingredients**\n• 3000g Nutella\n• 60g Vegetable Oil (2%)\n\n**Method**\n1. Add Vegetable Oil to Nutella.\n2. Mix until consistency is achieved — can take up to 5 minutes of hand mixing.\n\n_Wet scoop prior to use._",
    "fryer_op",
    "07:00",
    0,
    2,
  ],
  [
    "Make Peanut Butter Filling",
    "#F59E0B",
    15,
    "**Ingredients**\n• 1000g Peanut Butter\n• 200ml Vegetable Oil\n• 50g Icing Sugar _(NOT Snow Sugar)_\n\n**Method**\n1. Mix all ingredients thoroughly.\n\n_Makes enough for 100+ doughnuts._",
    "fryer_op",
    "07:00",
    0,
    2,
  ],

  // ── Prep: Glazes & Fondants ───────────────────────────────────────────────
  [
    "Prepare Classic Glaze",
    "#EAB308",
    15,
    "Supplied from Bakery Group.\n\nMix all contents thoroughly before use. Heat gently to 60–65°C if too thick.",
    "fryer_op",
    "07:30",
    0,
    1,
  ],
  [
    "Prepare Chocolate Fondant",
    "#EAB308",
    20,
    "**Ingredients**\n• 1000g White Fondant\n• 100g Butter\n• 200g Chocolate Buttons\n• 60g Cocoa Powder\n• 60ml Hot Water\n\n**Method**\n1. Place all ingredients in bain-marie.\n2. Bring to 65°C while stirring continuously.",
    "fryer_op",
    "07:30",
    0,
    1,
  ],
  [
    "Prepare Biscoff Fondant",
    "#EAB308",
    20,
    "**Ingredients**\n• 1000g White Fondant\n• 200g Biscoff Spread\n\n**Method**\n1. Place all ingredients in bain-marie.\n2. Bring to 65°C while stirring.\n\n_Bain-marie requires 30+ min to heat adequately — plan ahead._",
    "fryer_op",
    "07:30",
    0,
    1,
  ],
  [
    "Clean Fondant Bain-Marie",
    "#EAB308",
    30,
    "**Steps**\n1. Turn off bain-marie, allow to cool 30 min.\n2. Remove pans — allow Fondants to set hard.\n3. Fill all Fondant pans (except Choc) with cold water, sit 20 min.\n4. Wipe sides and tops clean.\n5. Refill with fresh Fondant and return to clean bain-marie.",
    "fryer_op",
    "17:00",
    0,
    1,
  ],

  // ── Recipes: Frappes ─────────────────────────────────────────────────────
  [
    "Recipe: White Choc Biscoff Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2/3 cup Milk\n• 1x large scoop Biscoff Spread\n• 4x small scoops White Chocolate Powder\n\n**Method**\n1. Blend 35 sec.\n2. Top with Whipped Cream Swirl and a dusting of Biscoff Crumb.\n\n_Wet the scoop with water before measuring Biscoff._",
    "counter_staff",
    "06:00",
    0,
    999,
  ],
  [
    "Recipe: Honeycomb Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2/3 cup Milk\n• 1.5x large scoops Honeycomb Frappe Powder\n• 1x large scoop Vanilla Frappe Powder\n• 12x Chocolate Buttons\n\n**Method**\n1. Blend 35 sec.\n2. Top with Whipped Cream Swirl and Dark Choc Flakettes.",
    "counter_staff",
    "06:00",
    0,
    999,
  ],
  [
    "Recipe: Coffee Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 1/4 cup Milk\n• 1 double shot Espresso (60ml)\n• 4x small scoops Vanilla Frappe Powder\n\n**Method**\n1. Blend 35 sec.\n2. Top with Whipped Cream Swirl and Dark Chocolate Flakettes.",
    "counter_staff",
    "06:00",
    0,
    999,
  ],
  [
    "Recipe: Salted Caramel Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2/3 cup Milk\n• 3 pumps Salted Caramel Syrup (22.5ml)\n• 1x small scoop Salted Caramel Balls\n\n**Method**\n1. Blend 35 sec.\n2. Top with Whipped Cream Swirl and Silky Caramel lattice.",
    "counter_staff",
    "06:00",
    0,
    999,
  ],
  [
    "Recipe: Matcha Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2/3 cup Milk\n• 1x small scoop Matcha Powder\n\n**Method**\n1. Mix Matcha Powder with a splash of boiling water to form a paste first.\n2. Blend all 35 sec.\n3. Top with Whipped Cream Swirl and a dusting of Matcha Powder.\n\n_Always make paste fresh — no premix._",
    "counter_staff",
    "06:00",
    0,
    999,
  ],

  // ── Recipes: Milkshakes ───────────────────────────────────────────────────
  [
    "Recipe: Chocolate Milkshake",
    "#EC4899",
    5,
    "**Small**\n• 1/2 cup Milk\n• 1/4 cup Soft Serve\n• 2 pumps Chocolate flavour\n\n**Large**\n• 1 cup Milk\n• 1/2 cup Soft Serve\n• 4 pumps Chocolate flavour\n\n**Thickshake** _(Large only)_\n• 3/4 cup Milk\n• 1 heaped cup Soft Serve\n• 4 pumps Chocolate flavour\n\n**Method**\n1. Blend 10 sec in metal cup.\n2. Serve in Striped cup with Slotted lid and straw.",
    "counter_staff",
    "06:00",
    0,
    999,
  ],
  [
    "Recipe: Biscoff Custard Shake",
    "#EC4899",
    5,
    "**Ingredients**\n• 1.5 cups Milk\n• 1.5 cups Ice\n• 1/2 cup Soft Serve\n• 1x large scoop Custard Powder\n• 1x large scoop Biscoff Spread\n\n**Method**\n1. Blend 20 sec.\n2. Top up with Milk if required.\n3. Serve in 22oz Striped cup with Slotted lid and straw.",
    "counter_staff",
    "06:00",
    0,
    999,
  ],

  // ── Weekly Cleaning ───────────────────────────────────────────────────────
  [
    "Clean Ice Cream Machine",
    "#22C55E",
    30,
    "Full sanitize cycle. Scheduled **Monday** and **Friday**.\n\n_All cleaning tasks must be completed in full and signed off by those responsible._",
    "counter_staff",
    "14:00",
    2,
    4,
  ],
  [
    "Deep Clean Hatco (Hot Jam) Unit",
    "#22C55E",
    45,
    "Deep clean of the Hatco hot jam unit. Scheduled **Tuesday**.\n\n_All cleaning tasks must be completed in full and signed off by those responsible._",
    "fryer_op",
    "14:30",
    5,
    8,
  ],
  [
    "Deep Clean All Fridges",
    "#22C55E",
    60,
    "Deep clean interior and exterior of all fridges. Scheduled **Thursday**.\n\n_All cleaning tasks must be completed in full and signed off by those responsible._",
    "shift_lead",
    "14:00",
    5,
    8,
  ],
  [
    "Deep Clean Doughnut Display",
    "#22C55E",
    30,
    "Deep clean the doughnut display unit. Scheduled **Friday**.\n\n_All cleaning tasks must be completed in full and signed off by those responsible._",
    "counter_staff",
    "15:00",
    5,
    8,
  ],
  [
    "Clean & Tidy Storeroom",
    "#22C55E",
    30,
    "Clean and tidy the storeroom. Scheduled **Sunday**.\n\n_All cleaning tasks must be completed in full and signed off by those responsible._",
    "shift_lead",
    "15:00",
    5,
    8,
  ],
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const reset = process.argv.includes("--reset");
  const { utcEntry } = makeDateUtils("Australia/Sydney");

  // ── Users ──────────────────────────────────────────────────────────────────
  console.log("→ Upserting users...");
  const [ivan, jordan, casey, riley, alex] = await Promise.all([
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
      where: { email: process.env.E2E_TEST_USER_EMAIL ?? "ivan@example.test" },
      update: { name: "Riley" },
      create: {
        email: process.env.E2E_TEST_USER_EMAIL ?? "ivan@example.test",
        name: "Riley",
      },
    }),
    prisma.user.upsert({
      where: { email: "alt28922@gmail.com" },
      update: { name: "Alex" },
      create: { email: "alt28922@gmail.com", name: "Alex" },
    }),
  ]);
  console.log("  ✓ 5 users upserted");

  // ── Org ────────────────────────────────────────────────────────────────────
  const existing = await prisma.organization.findFirst({
    where: { name: "Donut Shop A", ownerId: ivan.id },
  });

  if (existing) {
    if (reset) {
      console.log(`  🗑 --reset: deleting org (id: ${existing.id})...`);
      await prisma.organization.delete({ where: { id: existing.id } });
      console.log("  ✓ Deleted");
    } else {
      console.log(
        `  ℹ Org already exists (id: ${existing.id}). Use --reset to recreate.`,
      );
      return;
    }
  }

  console.log("→ Creating org...");
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
  console.log(`  ✓ Org created (id: ${org.id})`);

  // ── Roles ──────────────────────────────────────────────────────────────────
  console.log("→ Creating roles...");
  const [
    roleOwner,
    roleWorker,
    roleFryer,
    roleCounter,
    roleShiftLead,
    roleTrainee,
  ] = await Promise.all([
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
    prisma.role.create({
      data: {
        orgId: org.id,
        name: "Shift Lead",
        key: "shift_lead",
        color: "#8B5CF6",
        isDeletable: true,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org.id,
        name: "Trainee",
        key: "trainee",
        color: "#84CC16",
        isDeletable: true,
        isDefault: false,
      },
    }),
  ]);
  console.log("  ✓ 6 roles created");

  // ── Permissions ────────────────────────────────────────────────────────────
  console.log("→ Creating permissions...");
  await prisma.permission.createMany({
    data: [
      // Owner — all
      ...ALL_OWNER_PERMISSIONS.map((action) => ({
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

  // 5 bots
  const [
    mBotOpenSlot,
    mBotMorningRunner,
    mBotFryerBackup,
    mBotCounterFloat,
    mBotWeekendFill,
  ] = await Promise.all([
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Open Slot",
        workingDays: ["mon", "wed", "fri"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Morning Runner",
        workingDays: ["tue", "thu", "sat"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Fryer Backup",
        workingDays: ["mon", "tue", "wed"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Counter Float",
        workingDays: ["wed", "fri", "sun"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Weekend Fill",
        workingDays: ["sat", "sun"],
      },
    }),
  ]);
  console.log("  ✓ 5 members + 5 bots created");

  // ── Member Roles ───────────────────────────────────────────────────────────
  await prisma.memberRole.createMany({
    data: [
      { membershipId: mIvan.id, roleId: roleOwner.id },
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
  console.log(`→ Creating ${TASKS.length} tasks...`);
  const roleByKey: Record<string, string> = {
    counter_staff: roleCounter.id,
    fryer_op: roleFryer.id,
    shift_lead: roleShiftLead.id,
    trainee: roleTrainee.id,
    default_member: roleWorker.id,
  };

  const createdTasks = await Promise.all(
    TASKS.map(
      ([
        name,
        color,
        durationMin,
        description,
        roleKey,
        preferredStart,
        minWait,
        maxWait,
      ]) =>
        prisma.task
          .create({
            data: {
              orgId: org.id,
              name,
              color,
              durationMin,
              description,
              preferredStartTimeMin: timeToMin(preferredStart),
              minPeople: 1,
              minWaitDays: minWait,
              maxWaitDays: maxWait,
            },
          })
          .then(async (task) => {
            await prisma.taskEligibility.create({
              data: { taskId: task.id, roleId: roleByKey[roleKey] },
            });
            return { task, roleKey };
          }),
    ),
  );
  console.log(`  ✓ ${createdTasks.length} tasks + eligibilities created`);

  // Quick lookup helpers
  const tByName = Object.fromEntries(
    createdTasks.map(({ task }) => [task.name, task]),
  );
  const t = (name: string) => tByName[name];

  // ── Templates ──────────────────────────────────────────────────────────────
  console.log("→ Creating templates...");

  const [tplWeek1, tplWeekend, tplCleaning] = await Promise.all([
    prisma.template.create({
      data: { orgId: org.id, name: "Weekday Rotation", cycleLengthDays: 5 },
    }),
    prisma.template.create({
      data: { orgId: org.id, name: "Weekend Shift", cycleLengthDays: 2 },
    }),
    prisma.template.create({
      data: {
        orgId: org.id,
        name: "Weekly Cleaning Schedule",
        cycleLengthDays: 7,
      },
    }),
  ]);

  await prisma.templateEntry.createMany({
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

  // ── Timetable Entries ──────────────────────────────────────────────────────
  console.log("→ Creating timetable entries...");

  const entries: Promise<unknown>[] = [];

  // Helper to push entries
  const add = (
    taskName: string,
    offsetDays: number,
    hhmm: string,
    status: EntryStatus,
    membershipId: string,
  ) => {
    const task = t(taskName);
    entries.push(
      prisma.timetableEntry.create({
        data: {
          orgId: org.id,
          taskId: task.id,
          taskName: task.name,
          taskDescription: task.description,
          durationMin: task.durationMin,
          ...utcEntry(offsetDays, hhmm, task.durationMin),
          status,
          assignees: { create: [{ membershipId }] },
        },
      }),
    );
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

  await Promise.all(entries);
  console.log(`  ✓ ${entries.length} timetable entries created`);

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

  console.log("\n✅ Donut Shop A seeded successfully!");
  console.log(`   Org ID: ${org.id}`);
}

main()
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
