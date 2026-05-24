import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });

import fs from "fs";
import path from "path";

import {
  PrismaClient,
  PermissionAction,
  EntryStatus,
  InviteType,
  ViewType,
  TaskScope,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ROLE_KEYS } from "@/lib/rbac";
import { localToUTC } from "@/lib/date-utils";

// Adapter and Prisma client will be initialized after validation
let prisma: PrismaClient;

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

/**
 * Returns the Monday 00:00:00 UTC for the week `offsetWeeks` from now.
 * offsetWeeks = 0 → current week, -1 → last week, 1 → next week.
 */
function getMondayUTC(offsetWeeks = 0): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const daysToMon = day === 0 ? -6 : 1 - day;
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysToMon + offsetWeeks * 7,
    ),
  );
}

/**
 * Fetches a relevant image from LoremFlickr (Flickr-backed, keyword search)
 * and uploads it to the Supabase private bucket as the task's seed image.
 *
 * Non-fatal — if the upload fails for any reason the task simply has no image.
 */
async function uploadSeedTaskImage(
  orgId: string,
  taskId: string,
  keyword: string,
): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    // /all means any of the comma-separated keywords must match.
    // If the primary keyword returns no results, fall back to a generic food photo.
    const tryFetch = (kw: string) =>
      fetch(`https://loremflickr.com/800/600/${kw}/all`);
    let imgRes = await tryFetch(keyword);
    if (!imgRes.ok) imgRes = await tryFetch("bakery,food,donut");
    if (!imgRes.ok) return null;
    const imgData = await imgRes.arrayBuffer();

    const storagePath = `orgs/${orgId}/tasks/${taskId}/seed.jpg`;
    const uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/friendchise-private/${storagePath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "image/jpeg",
          "x-upsert": "true",
        },
        body: imgData,
      },
    );
    return uploadRes.ok ? storagePath : null;
  } catch {
    return null;
  }
}

/**
 * Uploads a file to the PUBLIC Supabase bucket (for org logos).
 * Returns the bare storage path on success, or null on failure.
 */
async function uploadOrgLogo(
  orgId: string,
  imageBuffer: Buffer,
): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const storagePath = `orgs/${orgId}/logo.jpg`;
    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/friendchise-public/${storagePath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "image/jpeg",
          "x-upsert": "true",
        },
        body: imageBuffer as unknown as BodyInit,
      },
    );
    return res.ok ? storagePath : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLEAN
//
// Add new models here (in child-before-parent order) as the schema grows.
// ─────────────────────────────────────────────────────────────────────────────

async function cleanDatabase() {
  await prisma.timetableEntryAssignee.deleteMany();
  await prisma.timetableTemplateEntryAssignee.deleteMany();
  await prisma.timetableEntry.deleteMany();
  await prisma.timetableTemplateEntry.deleteMany();
  await prisma.timetableTemplate.deleteMany();
  await prisma.taskEligibility.deleteMany();
  await prisma.taskTag.deleteMany();
  await prisma.taskInheritance.deleteMany();
  await prisma.task.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.rosterEntry.deleteMany();
  await prisma.rosterTemplateEntry.deleteMany();
  await prisma.rosterTemplate.deleteMany();
  await prisma.rosterDayConfig.deleteMany();
  await prisma.conversionSet.deleteMany(); // cascades rates, templates, template entries
  await prisma.toolItem.deleteMany();
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
  const [ivan, jordan, casey, riley, morgan, alex, taylor, sam, quinn] =
    await Promise.all([
      prisma.user.upsert({
        where: { email: "mystoganx2001@gmail.com" },
        update: { name: "Ivan", image: "https://i.pravatar.cc/150?img=3" },
        create: {
          email: "mystoganx2001@gmail.com",
          name: "Ivan",
          image: "https://i.pravatar.cc/150?img=3",
        },
      }),
      prisma.user.upsert({
        where: { email: "alt28918@gmail.com" },
        update: { name: "Jordan", image: "https://i.pravatar.cc/150?img=8" },
        create: {
          email: "alt28918@gmail.com",
          name: "Jordan",
          image: "https://i.pravatar.cc/150?img=8",
        },
      }),
      prisma.user.upsert({
        where: { email: "alt28919@gmail.com" },
        update: { name: "Casey", image: "https://i.pravatar.cc/150?img=12" },
        create: {
          email: "alt28919@gmail.com",
          name: "Casey",
          image: "https://i.pravatar.cc/150?img=12",
        },
      }),
      prisma.user.upsert({
        where: {
          email: process.env.E2E_TEST_USER_EMAIL ?? "ivan@example.test",
        },
        update: { name: "Riley", image: "https://i.pravatar.cc/150?img=5" },
        create: {
          email: process.env.E2E_TEST_USER_EMAIL ?? "ivan@example.test",
          name: "Riley",
          image: "https://i.pravatar.cc/150?img=5",
        },
      }),
      prisma.user.upsert({
        where: { email: "alt28921@gmail.com" },
        update: { name: "Morgan", image: "https://i.pravatar.cc/150?img=22" },
        create: {
          email: "alt28921@gmail.com",
          name: "Morgan",
          image: "https://i.pravatar.cc/150?img=22",
        },
      }),
      prisma.user.upsert({
        where: { email: "alt28922@gmail.com" },
        update: { name: "Alex", image: "https://i.pravatar.cc/150?img=15" },
        create: {
          email: "alt28922@gmail.com",
          name: "Alex",
          image: "https://i.pravatar.cc/150?img=15",
        },
      }),
      prisma.user.upsert({
        where: { email: "alt28923@gmail.com" },
        update: { name: "Taylor", image: "https://i.pravatar.cc/150?img=29" },
        create: {
          email: "alt28923@gmail.com",
          name: "Taylor",
          image: "https://i.pravatar.cc/150?img=29",
        },
      }),
      prisma.user.upsert({
        where: { email: "alt28924@gmail.com" },
        update: { name: "Sam", image: "https://i.pravatar.cc/150?img=35" },
        create: {
          email: "alt28924@gmail.com",
          name: "Sam",
          image: "https://i.pravatar.cc/150?img=35",
        },
      }),
      prisma.user.upsert({
        where: { email: "alt28920@gmail.com" },
        update: { name: "Quinn", image: "https://i.pravatar.cc/150?img=44" },
        create: {
          email: "alt28920@gmail.com",
          name: "Quinn",
          image: "https://i.pravatar.cc/150?img=44",
        },
      }),
    ]);

  return { ivan, jordan, casey, riley, morgan, alex, taylor, sam, quinn };
}

type Users = Awaited<ReturnType<typeof seedUsers>>;

// ─────────────────────────────────────────────────────────────────────────────
// 3. ORG 1 — Donut Shop A
//    Owner: Ivan  |  Members: Jordan, Casey, Riley, Alex + 5 bots
// ─────────────────────────────────────────────────────────────────────────────

type TaskDef = [string, string, number, string, string, string, number, number];

const DONUT_TASKS: TaskDef[] = [
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

// Tag names per task — used after both tasks and tags are created
const TASK_TAGS: Record<string, string[]> = {
  "Open Shop Checklist": ["Daily Ops", "Opening"],
  "Close Shop Checklist": ["Daily Ops", "Closing"],
  "Mid-Day Stock Check": ["Daily Ops"],
  "Restock Packaging & Supplies": ["Daily Ops"],
  "Fryer Oil Quality Check": ["Fryer", "Quality"],
  "Fry Morning Batches": ["Fryer"],
  "Fry Afternoon Batches": ["Fryer"],
  "Clean Fryer (End of Day)": ["Fryer", "Cleaning"],
  "Quality Check \u2014 Display & Products": ["Quality", "Daily Ops"],
  "Shift Handover": ["Daily Ops"],
  "Make Custard Cream": ["Prep"],
  "Make Choc Custard Cream": ["Prep"],
  "Make Biscoff Filling": ["Prep"],
  "Make Raspberry Cheesecake Filling": ["Prep"],
  "Make Nutella Filling": ["Prep"],
  "Make Peanut Butter Filling": ["Prep"],
  "Prepare Classic Glaze": ["Prep"],
  "Prepare Chocolate Fondant": ["Prep"],
  "Prepare Biscoff Fondant": ["Prep"],
  "Clean Fondant Bain-Marie": ["Prep", "Cleaning"],
  "Recipe: White Choc Biscoff Frappe": ["Recipe"],
  "Recipe: Honeycomb Frappe": ["Recipe"],
  "Recipe: Coffee Frappe": ["Recipe"],
  "Recipe: Salted Caramel Frappe": ["Recipe"],
  "Recipe: Matcha Frappe": ["Recipe"],
  "Recipe: Chocolate Milkshake": ["Recipe"],
  "Recipe: Biscoff Custard Shake": ["Recipe"],
  "Clean Ice Cream Machine": ["Cleaning"],
  "Deep Clean Hatco (Hot Jam) Unit": ["Cleaning"],
  "Deep Clean All Fridges": ["Cleaning"],
  "Deep Clean Doughnut Display": ["Cleaning"],
  "Clean & Tidy Storeroom": ["Cleaning"],
};

// LoremFlickr search keywords per task (comma-separated → ANY keyword must match)
const TASK_IMAGE_KEYWORDS: Record<string, string> = {
  "Open Shop Checklist": "bakery,morning",
  "Close Shop Checklist": "bakery,night",
  "Mid-Day Stock Check": "bakery,shelf",
  "Restock Packaging & Supplies": "packaging,boxes",
  "Fryer Oil Quality Check": "frying,cooking oil",
  "Fry Morning Batches": "doughnut,frying",
  "Fry Afternoon Batches": "doughnut,cooking",
  "Clean Fryer (End of Day)": "kitchen,cleaning",
  "Quality Check \u2014 Display & Products": "doughnut,display",
  "Shift Handover": "cafe,team",
  "Make Custard Cream": "custard,cream",
  "Make Choc Custard Cream": "chocolate,cream",
  "Make Biscoff Filling": "caramel,cookie,spread",
  "Make Raspberry Cheesecake Filling": "raspberry,cheesecake",
  "Make Nutella Filling": "chocolate,hazelnut",
  "Make Peanut Butter Filling": "peanut,spread",
  "Prepare Classic Glaze": "doughnut,glaze,icing",
  "Prepare Chocolate Fondant": "chocolate,fondant",
  "Prepare Biscoff Fondant": "caramel,cookie",
  "Clean Fondant Bain-Marie": "kitchen,pot,saucepan",
  "Recipe: White Choc Biscoff Frappe": "white chocolate,frappe",
  "Recipe: Honeycomb Frappe": "honeycomb,drink",
  "Recipe: Coffee Frappe": "coffee,frappe",
  "Recipe: Salted Caramel Frappe": "caramel,frappe",
  "Recipe: Matcha Frappe": "matcha,green tea",
  "Recipe: Chocolate Milkshake": "chocolate,milkshake",
  "Recipe: Biscoff Custard Shake": "milkshake,caramel",
  "Clean Ice Cream Machine": "ice cream,soft serve",
  "Deep Clean Hatco (Hot Jam) Unit": "jam,kitchen",
  "Deep Clean All Fridges": "refrigerator,fridge",
  "Deep Clean Doughnut Display": "doughnut,display",
  "Clean & Tidy Storeroom": "storage,shelves",
};

async function seedOrg1(users: Users) {
  const { ivan, jordan, casey, riley, alex } = users;
  const { utcEntry } = makeDateUtils("Australia/Sydney");

  // ── Org ────────────────────────────────────────────────────────────────────
  console.log("→ Creating org...");
  const org = await prisma.organization.create({
    data: {
      name: "Donut Shop A",
      ownerId: ivan.id,
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
    const logoStoragePath = await uploadOrgLogo(org.id, logoBuffer);
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
  console.log(`→ Creating ${DONUT_TASKS.length} tasks...`);
  const roleByKey: Record<string, string> = {
    counter_staff: roleCounter.id,
    fryer_op: roleFryer.id,
    shift_lead: roleShiftLead.id,
    trainee: roleTrainee.id,
    default_member: roleWorker.id,
  };

  const createdTasks: {
    task: {
      id: string;
      name: string;
      description: string | null;
      durationMin: number;
    };
    roleKey: string;
  }[] = [];
  for (const [
    name,
    color,
    durationMin,
    description,
    roleKey,
    preferredStart,
    minWait,
    maxWait,
  ] of DONUT_TASKS) {
    const task = await prisma.task.create({
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
    });
    const roleId = roleByKey[roleKey];
    if (roleId === undefined) {
      throw new Error(
        `Role key "${roleKey}" not found in roleByKey lookup for task "${task.name}". Available keys: ${Object.keys(roleByKey).join(", ")}`,
      );
    }
    await prisma.taskEligibility.create({ data: { taskId: task.id, roleId } });
    // Mirror what createTask() does in the service layer
    await prisma.taskInheritance.create({
      data: { taskId: task.id, orgId: org.id },
    });
    createdTasks.push({ task, roleKey });
  }
  console.log(
    `  ✓ ${createdTasks.length} tasks + eligibilities + inheritances created`,
  );

  // ── Task Images ────────────────────────────────────────────────────────────
  console.log("→ Uploading task images...");
  // Phase 1: fetch + upload to Supabase in parallel (no DB connections)
  const uploadResults = await Promise.all(
    createdTasks.map(async ({ task }, idx) => {
      const keyword = TASK_IMAGE_KEYWORDS[task.name] ?? "bakery,food";
      const storagePath = await uploadSeedTaskImage(org.id, task.id, keyword);
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
  const [
    tagDailyOps,
    tagFryer,
    tagPrep,
    tagRecipe,
    tagCleaning,
    tagQuality,
    tagOpening,
    tagClosing,
  ] = await Promise.all([
    prisma.tag.create({
      data: { orgId: org.id, name: "Daily Ops", color: "#F59E0B" },
    }),
    prisma.tag.create({
      data: { orgId: org.id, name: "Fryer", color: "#F97316" },
    }),
    prisma.tag.create({
      data: { orgId: org.id, name: "Prep", color: "#EC4899" },
    }),
    prisma.tag.create({
      data: { orgId: org.id, name: "Recipe", color: "#8B5CF6" },
    }),
    prisma.tag.create({
      data: { orgId: org.id, name: "Cleaning", color: "#22C55E" },
    }),
    prisma.tag.create({
      data: { orgId: org.id, name: "Quality", color: "#A855F7" },
    }),
    prisma.tag.create({
      data: { orgId: org.id, name: "Opening", color: "#3B82F6" },
    }),
    prisma.tag.create({
      data: { orgId: org.id, name: "Closing", color: "#EF4444" },
    }),
  ]);
  const tagByName: Record<string, { id: string }> = {
    "Daily Ops": tagDailyOps,
    Fryer: tagFryer,
    Prep: tagPrep,
    Recipe: tagRecipe,
    Cleaning: tagCleaning,
    Quality: tagQuality,
    Opening: tagOpening,
    Closing: tagClosing,
  };
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

  // Process in batches of 4 to stay within Supabase session-mode pool limit
  // Each nested-write create uses an implicit transaction (2 conns), and pnpm dev holds ~3-4.
  // 4 × 2 = 8 seed conns + 4 dev conns = 12, safely under the pool_size: 15 cap.
  const BATCH_SIZE = 4;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    await Promise.all(entries.slice(i, i + BATCH_SIZE));
  }
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
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 0,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekIndex: 0,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        templateId: rosterTemplate.id,
        membershipId: mIvan.id,
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
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 0,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekStart: weekPrev,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mIvan.id,
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
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 0,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekStart: weekCurr,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mIvan.id,
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
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 0,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 1,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 2,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mIvan.id,
        membershipOrgId: org.id,
        weekStart: weekNext,
        dayIndex: 3,
        shiftStartMin: 360,
        shiftEndMin: 840,
      },
      {
        orgId: org.id,
        membershipId: mIvan.id,
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
  const [
    tiDoughRings,
    tiCustardPowder,
    tiColdWater,
    tiWhippingCream,
    tiBiscoffSpread,
    tiVegetableOil,
    tiNutella,
    tiPeanutButter,
    tiIcingSugar,
    tiWhiteFondant,
    tiButter,
    tiChocButtons,
    tiCocoaPowder,
    tiHotWater,
    tiChocPowder,
    tiQuark,
  ] = await Promise.all([
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Dough Rings", unit: "each" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Custard Powder", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Cold Water", unit: "ml" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Whipping Cream", unit: "ml" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Biscoff Spread", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Vegetable Oil", unit: "ml" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Nutella", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Peanut Butter", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Icing Sugar", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "White Fondant", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Butter", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Chocolate Buttons", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Cocoa Powder", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Hot Water", unit: "ml" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Chocolate Powder", unit: "scoops" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Quark", unit: "g" },
    }),
  ]);
  console.log("  ✓ 16 tool items created");
  // Silence unused-variable warnings for items not used directly in conversion rates
  void tiVegetableOil;
  void tiNutella;
  void tiPeanutButter;
  void tiIcingSugar;
  void tiQuark;

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

// ─────────────────────────────────────────────────────────────────────────────
// 4. FRANCHISEE — Donut Shop A: Quinn (Melbourne)
//    Owner: Quinn  |  Members: Morgan, Taylor
//    Inherits all GLOBAL tasks from org1
// ─────────────────────────────────────────────────────────────────────────────

async function seedFranchisee(
  users: Users,
  org1: Awaited<ReturnType<typeof seedOrg1>>,
) {
  const { quinn, morgan, taylor } = users;

  console.log("→ Creating franchisee org...");
  const org = await prisma.organization.create({
    data: {
      name: "Donut Shop A: Quinn",
      ownerId: quinn.id,
      image: null,
      address: "12 Flinders Lane, Melbourne VIC 3000",
      parentId: org1.org.id,
      openTimeMin: timeToMin("07:00"),
      closeTimeMin: timeToMin("17:00"),
      timezone: "Australia/Melbourne",
      operatingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
    },
  });

  // Upload org logo from public/ folder
  try {
    const logoBuffer = fs.readFileSync(
      path.join(process.cwd(), "public/donut_a_logo.jpg"),
    );
    const logoPath = await uploadOrgLogo(org.id, logoBuffer);
    if (logoPath) {
      await prisma.organization.update({
        where: { id: org.id },
        data: { image: logoPath },
      });
      console.log("  ✓ Org logo uploaded");
    }
  } catch {
    console.log(
      "  ⚠ Org logo upload skipped (file not found or upload failed)",
    );
  }

  // ── Roles (mirror parent structure) ───────────────────────────────────────
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

  await prisma.permission.createMany({
    data: [
      ...ALL_OWNER_PERMISSIONS.map((action) => ({
        roleId: roleOwner.id,
        action,
      })),
      { roleId: roleWorker.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: roleFryer.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: roleFryer.id, action: PermissionAction.MANAGE_TASKS },
      { roleId: roleCounter.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: roleShiftLead.id, action: PermissionAction.VIEW_TIMETABLE },
      { roleId: roleShiftLead.id, action: PermissionAction.MANAGE_TIMETABLE },
      { roleId: roleShiftLead.id, action: PermissionAction.MANAGE_MEMBERS },
      { roleId: roleTrainee.id, action: PermissionAction.VIEW_TIMETABLE },
    ],
    skipDuplicates: true,
  });

  // ── Memberships ────────────────────────────────────────────────────────────
  const [mQuinn, mMorgan, mTaylor] = await Promise.all([
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: quinn.id,
        workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: morgan.id,
        workingDays: ["tue", "wed", "thu", "fri", "sat"],
      },
    }),
    prisma.membership.create({
      data: {
        orgId: org.id,
        userId: taylor.id,
        workingDays: ["mon", "wed", "fri"],
      },
    }),
  ]);

  await prisma.memberRole.createMany({
    data: [
      { membershipId: mQuinn.id, roleId: roleOwner.id },
      { membershipId: mMorgan.id, roleId: roleWorker.id },
      { membershipId: mMorgan.id, roleId: roleShiftLead.id },
      { membershipId: mTaylor.id, roleId: roleWorker.id },
      { membershipId: mTaylor.id, roleId: roleFryer.id },
    ],
  });
  console.log("  ✓ Roles, permissions, and memberships created");

  // ── Tool Items ─────────────────────────────────────────────────────────────
  console.log("→ Creating franchisee tool items...");
  const [
    qtiDoughRings,
    qtiCustardPowder,
    qtiColdWater,
    qtiWhippingCream,
    qtiChocButtons,
    qtiHoneycombFlavour,
    qtiStrawberryPowder,
    qtiVanillaChai,
    qtiWhiteFondant,
    qtiBiscoffSpread,
    qtiButter,
    qtiCocoaPowder,
    qtiHotWater,
    qtiCoconutMilk,
    qtiMatchaPowder,
    qtiEspressoShot,
    qtiBananaFlavacol,
    qtiMilk,
    qtiIce,
    qtiDrink,
    qtiCinnamonPowder,
    qtiCasterSugar,
  ] = await Promise.all([
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Dough Rings", unit: "each" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Custard Powder", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Cold Water", unit: "ml" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Whipping Cream", unit: "ml" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Chocolate Buttons", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Honeycomb Flavour", unit: "ml" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Strawberry Frappe Powder", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Vanilla Chai Powder", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "White Fondant", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Biscoff Spread", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Butter", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Cocoa Powder", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Hot Water", unit: "ml" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Coconut Milk", unit: "ml" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Matcha Powder", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Espresso Shot", unit: "ml" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Banana Flavacol", unit: "ml" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Milk", unit: "ml" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Ice", unit: "cups" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Drink", unit: "each" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Cinnamon Powder", unit: "g" },
    }),
    prisma.toolItem.create({
      data: { orgId: org.id, name: "Caster Sugar", unit: "g" },
    }),
  ]);
  void qtiCinnamonPowder;
  void qtiCasterSugar;
  console.log("  ✓ 22 tool items created");

  // ── Conversion Sets ────────────────────────────────────────────────────────
  console.log("→ Creating franchisee conversion sets...");

  // — Custard Cream — All Variants —
  const qSetCustard = await prisma.conversionSet.create({
    data: { orgId: org.id, name: "Custard Cream — All Variants" },
  });
  await prisma.conversionRate.createMany({
    data: [
      // Base recipe: 215 rings → base ingredients
      {
        setId: qSetCustard.id,
        fromItemId: qtiDoughRings.id,
        toItemId: qtiCustardPowder.id,
        fromQty: 215,
        toQty: 1250,
      },
      {
        setId: qSetCustard.id,
        fromItemId: qtiDoughRings.id,
        toItemId: qtiColdWater.id,
        fromQty: 215,
        toQty: 2500,
      },
      {
        setId: qSetCustard.id,
        fromItemId: qtiDoughRings.id,
        toItemId: qtiWhippingCream.id,
        fromQty: 215,
        toQty: 5000,
      },
      // Flavour add-ins per 40 rings
      {
        setId: qSetCustard.id,
        fromItemId: qtiDoughRings.id,
        toItemId: qtiChocButtons.id,
        fromQty: 40,
        toQty: 100,
      },
      {
        setId: qSetCustard.id,
        fromItemId: qtiDoughRings.id,
        toItemId: qtiHoneycombFlavour.id,
        fromQty: 40,
        toQty: 50,
      },
      {
        setId: qSetCustard.id,
        fromItemId: qtiDoughRings.id,
        toItemId: qtiStrawberryPowder.id,
        fromQty: 40,
        toQty: 160,
      },
      {
        setId: qSetCustard.id,
        fromItemId: qtiDoughRings.id,
        toItemId: qtiVanillaChai.id,
        fromQty: 40,
        toQty: 120,
      },
    ],
    skipDuplicates: true,
  });
  const [qTplStandard, qTplWeekend, qTplQuiet] = await Promise.all([
    prisma.conversionTemplate.create({
      data: { setId: qSetCustard.id, name: "Standard Day — 180 rings" },
    }),
    prisma.conversionTemplate.create({
      data: { setId: qSetCustard.id, name: "Weekend Rush — 280 rings" },
    }),
    prisma.conversionTemplate.create({
      data: { setId: qSetCustard.id, name: "Quiet Monday — 120 rings" },
    }),
  ]);
  await prisma.conversionTemplateEntry.createMany({
    data: [
      { templateId: qTplStandard.id, itemId: qtiDoughRings.id, quantity: 180 },
      { templateId: qTplWeekend.id, itemId: qtiDoughRings.id, quantity: 280 },
      { templateId: qTplQuiet.id, itemId: qtiDoughRings.id, quantity: 120 },
    ],
    skipDuplicates: true,
  });

  // — Full Fondant Station —
  const qSetFondant = await prisma.conversionSet.create({
    data: { orgId: org.id, name: "Full Fondant Station" },
  });
  await prisma.conversionRate.createMany({
    data: [
      // Per 1000g White Fondant → add-ins for each flavour
      {
        setId: qSetFondant.id,
        fromItemId: qtiWhiteFondant.id,
        toItemId: qtiBiscoffSpread.id,
        fromQty: 1000,
        toQty: 200,
      },
      {
        setId: qSetFondant.id,
        fromItemId: qtiWhiteFondant.id,
        toItemId: qtiButter.id,
        fromQty: 1000,
        toQty: 100,
      },
      {
        setId: qSetFondant.id,
        fromItemId: qtiWhiteFondant.id,
        toItemId: qtiChocButtons.id,
        fromQty: 1000,
        toQty: 200,
      },
      {
        setId: qSetFondant.id,
        fromItemId: qtiWhiteFondant.id,
        toItemId: qtiCocoaPowder.id,
        fromQty: 1000,
        toQty: 60,
      },
      {
        setId: qSetFondant.id,
        fromItemId: qtiWhiteFondant.id,
        toItemId: qtiHotWater.id,
        fromQty: 1000,
        toQty: 60,
      },
      {
        setId: qSetFondant.id,
        fromItemId: qtiWhiteFondant.id,
        toItemId: qtiCoconutMilk.id,
        fromQty: 1000,
        toQty: 100,
      },
      {
        setId: qSetFondant.id,
        fromItemId: qtiWhiteFondant.id,
        toItemId: qtiMatchaPowder.id,
        fromQty: 1000,
        toQty: 15,
      },
      {
        setId: qSetFondant.id,
        fromItemId: qtiWhiteFondant.id,
        toItemId: qtiEspressoShot.id,
        fromQty: 1000,
        toQty: 60,
      },
      {
        setId: qSetFondant.id,
        fromItemId: qtiWhiteFondant.id,
        toItemId: qtiBananaFlavacol.id,
        fromQty: 1000,
        toQty: 40,
      },
    ],
    skipDuplicates: true,
  });
  const [qTplFondantSingle, qTplFondantDouble] = await Promise.all([
    prisma.conversionTemplate.create({
      data: { setId: qSetFondant.id, name: "Single Batch per Flavour (1000g)" },
    }),
    prisma.conversionTemplate.create({
      data: { setId: qSetFondant.id, name: "Double All Batches (2000g)" },
    }),
  ]);
  await prisma.conversionTemplateEntry.createMany({
    data: [
      {
        templateId: qTplFondantSingle.id,
        itemId: qtiWhiteFondant.id,
        quantity: 1000,
      },
      {
        templateId: qTplFondantDouble.id,
        itemId: qtiWhiteFondant.id,
        quantity: 2000,
      },
    ],
    skipDuplicates: true,
  });

  // — Frappe Bar Daily Prep —
  const qSetFrappe = await prisma.conversionSet.create({
    data: { orgId: org.id, name: "Frappe Bar Daily Prep" },
  });
  await prisma.conversionRate.createMany({
    data: [
      // Per 1 Drink (each) → ingredients needed
      {
        setId: qSetFrappe.id,
        fromItemId: qtiDrink.id,
        toItemId: qtiMilk.id,
        fromQty: 1,
        toQty: 160,
      },
      {
        setId: qSetFrappe.id,
        fromItemId: qtiDrink.id,
        toItemId: qtiIce.id,
        fromQty: 1,
        toQty: 1,
      },
      {
        setId: qSetFrappe.id,
        fromItemId: qtiDrink.id,
        toItemId: qtiBiscoffSpread.id,
        fromQty: 1,
        toQty: 50,
      },
      {
        setId: qSetFrappe.id,
        fromItemId: qtiDrink.id,
        toItemId: qtiMatchaPowder.id,
        fromQty: 1,
        toQty: 5,
      },
      {
        setId: qSetFrappe.id,
        fromItemId: qtiDrink.id,
        toItemId: qtiVanillaChai.id,
        fromQty: 1,
        toQty: 20,
      },
      {
        setId: qSetFrappe.id,
        fromItemId: qtiDrink.id,
        toItemId: qtiStrawberryPowder.id,
        fromQty: 1,
        toQty: 20,
      },
    ],
    skipDuplicates: true,
  });
  const [qTplFrappeWeekday, qTplFrappeWeekend] = await Promise.all([
    prisma.conversionTemplate.create({
      data: { setId: qSetFrappe.id, name: "Weekday Bar (30 drinks)" },
    }),
    prisma.conversionTemplate.create({
      data: { setId: qSetFrappe.id, name: "Weekend Rush (80 drinks)" },
    }),
  ]);
  await prisma.conversionTemplateEntry.createMany({
    data: [
      { templateId: qTplFrappeWeekday.id, itemId: qtiDrink.id, quantity: 30 },
      { templateId: qTplFrappeWeekend.id, itemId: qtiDrink.id, quantity: 80 },
    ],
    skipDuplicates: true,
  });
  console.log("  ✓ 3 conversion sets + rates + templates created");

  // ── Own GLOBAL tasks (franchisee contributions) ───────────────────────────
  console.log("→ Creating franchisee GLOBAL tasks...");
  const roleByKey: Record<string, { id: string }> = {
    fryer_op: roleFryer,
    counter_staff: roleCounter,
  };
  const QUINN_GLOBAL_TASKS = [
    {
      name: "Make Matcha White Choc Glaze",
      color: "#10B981",
      durationMin: 20,
      description:
        "**Ingredients**\n" +
        "• 1000g White Fondant\n" +
        "• 100ml Coconut Milk\n" +
        "• 15g Ceremonial Matcha Powder\n" +
        "• 50g White Chocolate Chips\n\n" +
        "**Method**\n" +
        "1. Warm White Fondant and Coconut Milk in bain-marie to 65°C.\n" +
        "2. Sift in Matcha Powder gradually — whisk continuously to avoid lumps.\n" +
        "3. Fold in White Chocolate Chips and stir until fully melted.\n" +
        "4. Strain through a fine mesh sieve for a smooth, glossy finish.\n" +
        "5. Use immediately or keep warm in bain-marie.\n\n" +
        "_Developed by Donut Shop A: Quinn. Shared across the franchise network._",
      roleKey: "fryer_op",
      keyword: "matcha,white chocolate,glaze",
    },
    {
      name: "Make Honeycomb Custard Cream",
      color: "#F59E0B",
      durationMin: 20,
      description:
        "**Per 1kg Custard Cream:**\n" +
        "• 50ml Honeycomb Flavour\n\n" +
        "**Method**\n" +
        "1. Add Honeycomb Flavour to prepared Custard Cream.\n" +
        "2. Mix thoroughly.\n\n" +
        "_Developed by Donut Shop A: Quinn._",
      roleKey: "fryer_op",
      keyword: "honeycomb,cream,dessert",
    },
    {
      name: "Make Strawberry Custard Cream",
      color: "#F59E0B",
      durationMin: 20,
      description:
        "**Per 1kg Custard Cream:**\n" +
        "• 160g Strawberry Frappe Powder\n\n" +
        "**Method**\n" +
        "1. Add Strawberry Frappe Powder to prepared Custard Cream.\n" +
        "2. Mix thoroughly.\n\n" +
        "_Developed by Donut Shop A: Quinn._",
      roleKey: "fryer_op",
      keyword: "strawberry,cream,pastry",
    },
    {
      name: "Prepare Coffee Fondant",
      color: "#EAB308",
      durationMin: 20,
      description:
        "**Ingredients**\n" +
        "• 1000g White Fondant\n" +
        "• 1 Double Espresso shot (60ml)\n\n" +
        "**Method**\n" +
        "1. Warm White Fondant in bain-marie to 65°C.\n" +
        "2. Add espresso shot and mix thoroughly until fully incorporated.\n\n" +
        "_Optimum working temperature: 65°C. Keep warm in bain-marie during service._",
      roleKey: "fryer_op",
      keyword: "coffee,fondant,espresso",
    },
    {
      name: "Prepare Banana Fondant",
      color: "#EAB308",
      durationMin: 20,
      description:
        "**Ingredients**\n" +
        "• 1000g White Fondant\n" +
        "• 40ml Banana Flavacol\n\n" +
        "**Method**\n" +
        "1. Bring Fondant to 65°C in bain-marie.\n" +
        "2. Add Banana Flavacol and mix thoroughly.\n\n" +
        "_Bain-marie requires 30+ min to heat adequately — plan ahead._",
      roleKey: "fryer_op",
      keyword: "banana,fondant,pastry",
    },
    {
      name: "Make French Toast Sugar",
      color: "#F59E0B",
      durationMin: 15,
      description:
        "**Ingredients**\n" +
        "• 1000g Caster Sugar\n" +
        "• 500g Icing Sugar _(NOT Snow Sugar)_\n" +
        "• 100g Cinnamon Powder\n\n" +
        "**Method**\n" +
        "1. Mix all ingredients thoroughly.\n\n" +
        "_Makes enough coating for 100+ doughnuts. Store in airtight container._",
      roleKey: "fryer_op",
      keyword: "cinnamon,sugar,baking",
    },
    {
      name: "Recipe: Strawberries & Cream Frappe",
      color: "#8B5CF6",
      durationMin: 5,
      description:
        "**Ingredients**\n" +
        "• 1 full cup Ice\n" +
        "• 2/3 cup Milk\n" +
        "• 3x small scoops White Chocolate Powder\n" +
        "• 4x small scoops Strawberry Frappe Powder\n\n" +
        "**Method**\n" +
        "1. Blend 35 sec.\n" +
        "2. Top with Whipped Cream Swirl and a dusting of Freeze Dried Raspberries.",
      roleKey: "counter_staff",
      keyword: "strawberry,cream,frappe",
    },
    {
      name: "Recipe: Vanilla Chai Frappe",
      color: "#8B5CF6",
      durationMin: 5,
      description:
        "**Ingredients**\n" +
        "• 1 full cup Ice\n" +
        "• 1/2 cup Milk\n" +
        "• 4x small scoops Vanilla Frappe Powder\n" +
        "• 3x small scoops Vanilla Chai Powder\n\n" +
        "**Method**\n" +
        "1. Blend 35 sec.\n" +
        "2. Top with Whipped Cream Swirl and dust with Cinnamon.",
      roleKey: "counter_staff",
      keyword: "chai,vanilla,drink",
    },
    {
      name: "Recipe: Iced Latte",
      color: "#06B6D4",
      durationMin: 5,
      description:
        "**Ingredients**\n" +
        "• 1 full cup Ice\n" +
        "• 2x Double Espresso shots\n" +
        "• 1 cup Milk\n\n" +
        "**Method**\n" +
        "1. Fill cup with Ice.\n" +
        "2. Add espresso, then top with Milk to the brim.\n" +
        "3. Serve in 16oz PET cup with Dome lid and straw.\n\n" +
        "_Sugar syrup can be added at customer request._",
      roleKey: "counter_staff",
      keyword: "iced coffee,latte",
    },
    {
      name: "Recipe: Iced Matcha",
      color: "#06B6D4",
      durationMin: 5,
      description:
        "**Ingredients**\n" +
        "• 1 full cup Ice\n" +
        "• 1 cup Milk\n" +
        "• 1x small scoop Matcha Powder\n" +
        "• Boiling water (for paste)\n\n" +
        "**Method**\n" +
        "1. Mix Matcha Powder with boiling water to form a paste.\n" +
        "2. Fill cup with Ice, add Milk then Matcha paste, mix.\n" +
        "3. Top up with Milk.\n" +
        "4. Serve in 16oz PET cup with Dome lid and straw.\n\n" +
        "_Always make Matcha paste fresh — no premix._",
      roleKey: "counter_staff",
      keyword: "matcha,iced,drink",
    },
    {
      name: "Recipe: Iced Chai",
      color: "#06B6D4",
      durationMin: 5,
      description:
        "**Ingredients**\n" +
        "• 1 full cup Ice\n" +
        "• 1 cup Milk\n" +
        "• 4x small scoops Vanilla Chai Powder\n" +
        "• Boiling water (for paste)\n\n" +
        "**Method**\n" +
        "1. Mix Vanilla Chai Powder with boiling water to form a paste.\n" +
        "2. Fill cup with Ice, add Milk then Chai paste, mix.\n" +
        "3. Top up with Milk.\n" +
        "4. Serve in 16oz PET cup with Dome lid and straw.",
      roleKey: "counter_staff",
      keyword: "chai,tea,iced",
    },
  ];

  let globalTasksCreated = 0;
  let globalTaskImages = 0;
  for (const def of QUINN_GLOBAL_TASKS) {
    const task = await prisma.task.create({
      data: {
        orgId: org.id,
        name: def.name,
        color: def.color,
        durationMin: def.durationMin,
        description: def.description,
        preferredStartTimeMin: timeToMin("07:30"),
        minPeople: 1,
        minWaitDays: 0,
        maxWaitDays: 1,
        scope: TaskScope.GLOBAL,
      },
    });
    const role = roleByKey[def.roleKey] ?? roleFryer;
    await prisma.taskEligibility.create({
      data: { taskId: task.id, roleId: role.id },
    });
    await prisma.taskInheritance.create({
      data: { taskId: task.id, orgId: org.id },
    });
    const imgUrl = await uploadSeedTaskImage(org.id, task.id, def.keyword);
    if (imgUrl) {
      await prisma.task.update({
        where: { id: task.id },
        data: { imageUrl: imgUrl },
      });
      globalTaskImages++;
    }
    globalTasksCreated++;
  }
  console.log(
    `  ✓ ${globalTasksCreated} GLOBAL tasks created (${globalTaskImages} with images)`,
  );

  // ── Inherit GLOBAL tasks from parent ──────────────────────────────────────
  const globalTasks = await prisma.task.findMany({
    where: { orgId: org1.org.id, scope: TaskScope.GLOBAL },
    select: { id: true, name: true },
  });
  if (globalTasks.length > 0) {
    await prisma.taskInheritance.createMany({
      data: globalTasks.map(({ id }) => ({ taskId: id, orgId: org.id })),
      skipDuplicates: true,
    });
  }
  console.log(
    `  ✓ Franchisee created: ${org.name} (inherited ${globalTasks.length} tasks)`,
  );

  return { org };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. INVITES — pending invite for Sam to join Donut Shop A
// ─────────────────────────────────────────────────────────────────────────────

async function seedInvites(
  users: Users,
  org1: Awaited<ReturnType<typeof seedOrg1>>,
) {
  await prisma.invite.createMany({
    data: [
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
  const dbUrl = process.env.DATABASE_URL;

  // Validate DATABASE_URL is present
  if (!dbUrl) {
    console.error("  ❌ ERROR: DATABASE_URL is not set.");
    console.error("  Aborted — nothing was changed.\n");
    process.exit(1);
  }

  // Validate DATABASE_URL is a valid URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(dbUrl);
  } catch {
    console.error("  ❌ ERROR: DATABASE_URL is not a valid URL.");
    console.error("  Aborted — nothing was changed.\n");
    process.exit(1);
  }

  const devIdentifiers = (process.env.SEED_DEV_IDENTIFIERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const isProduction = !(
    parsedUrl.hostname.includes("localhost") ||
    parsedUrl.hostname.includes("dev") ||
    parsedUrl.username.includes("dev") ||
    devIdentifiers.some(
      (id) =>
        parsedUrl.username.includes(id) || parsedUrl.hostname.includes(id),
    )
  );
  const expected = isProduction ? "production" : "development";
  const arg = process.argv[2];

  console.log("");
  console.log(`  Target database : ${parsedUrl.hostname}`);
  console.log(`  Environment     : ${expected.toUpperCase()}`);
  console.log("");

  if (arg !== expected) {
    if (isProduction) {
      console.log(
        "  ⚠️  WARNING: This targets PRODUCTION. Run: pnpm seed:prod",
      );
    } else {
      console.log("  Run: pnpm seed:dev");
    }
    console.log("  Aborted — nothing was changed.\n");
    process.exit(1);
  }

  if (isProduction) {
    // Require explicit env var confirmation for production
    if (process.env.CONFIRM_RESEED !== "production") {
      console.log(
        "  ❌ ERROR: Production reseed requires explicit confirmation.",
      );
      console.log("  Set CONFIRM_RESEED=production to proceed.");
      console.log("  Aborted — nothing was changed.\n");
      process.exit(1);
    }
    console.log("  ⚠️  WARNING: This will WIPE and reseed PRODUCTION.");
    console.log("");
  }

  // Initialize Prisma client after validation
  const adapter = new PrismaPg({ connectionString: dbUrl });
  prisma = new PrismaClient({ adapter });
}

async function main() {
  confirm();
  await cleanDatabase();
  const users = await seedUsers();
  const org1 = await seedOrg1(users);
  const franchisee = await seedFranchisee(users, org1);
  await seedInvites(users, org1);

  console.log("Seeded successfully:", {
    users: Object.fromEntries(Object.entries(users).map(([k, v]) => [k, v.id])),
    orgs: {
      "Donut Shop A": org1.org.id,
      "Donut Shop A: Quinn": franchisee.org.id,
    },
  });
}

main()
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
