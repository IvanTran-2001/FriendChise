/**
 * Demo session provisioning for the portfolio showcase.
 *
 * Creates an isolated, per-visitor demo org pre-seeded with the
 * "Donut Shop A" dataset. The demo visitor becomes the Owner;
 * supporting cast (Jordan, Casey, Riley, Alex) are bots — no real
 * user accounts required.
 *
 * Usage (server action):
 *   const { userId, orgId } = await prepareDemoSession();
 *   await signIn("demo", { userId, redirectTo: `/orgs/${orgId}` });
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/rbac";
import { localToUTC } from "@/lib/date-utils";
import { PermissionAction, EntryStatus, VoteType, TaskScope } from "@prisma/client";

const DEMO_MAX_CONCURRENT = 200;
const DEMO_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
/**
 * JWT session lifetime for demo accounts (1 hour).
 * Aggressive cleanup uses this as its cutoff so sessions are never removed
 * before their token expires. Capacity checks use it to exclude rows whose
 * JWT has already expired. Must stay in sync with the token.exp logic in auth.ts.
 */
export const DEMO_JWT_TTL_MS = 1 * 60 * 60 * 1000; // 1 hour
const DEMO_GLOBAL_TASK_SOFT_CAP = 1480; // trigger aggressive cleanup at this threshold (80% of hard cap = 1480 / 1850 ≈ 80%)
const DEMO_GLOBAL_TASK_HARD_CAP = DEMO_MAX_CONCURRENT * 37; // hard reject new sessions above this threshold (200 * 37 / 4 = 1850)

/** Per-entity limits enforced inside active demo sessions. */
export const DEMO_LIMITS = {
  PER_ORG_TASKS: 200,  // max tasks a single demo org can hold
  PER_ORG_MEMBERS: 50, // max memberships per demo org
  PER_USER_ORGS: 5,    // max orgs a demo user can own
} as const;

/** Returns true if the email belongs to a demo visitor account. */
export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith("@demo.friendchise.app");
}

/**
 * Checks whether a demo user has hit a per-entity resource limit.
 * Returns `{ ok: true }` for non-demo users (no-op) and for demo users
 * who are within their quota.
 */
export async function checkDemoLimit(
  userEmail: string | null | undefined,
  type: "task" | "member" | "org",
  orgId?: string,
  userId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!userEmail || !isDemoEmail(userEmail)) return { ok: true };

  if (type === "task" && orgId) {
    const count = await prisma.task.count({ where: { orgId } });
    if (count >= DEMO_LIMITS.PER_ORG_TASKS) {
      return {
        ok: false,
        error: `Demo orgs are limited to ${DEMO_LIMITS.PER_ORG_TASKS} tasks.`,
      };
    }
  } else if (type === "member" && orgId) {
    const count = await prisma.membership.count({ where: { orgId } });
    if (count >= DEMO_LIMITS.PER_ORG_MEMBERS) {
      return {
        ok: false,
        error: `Demo orgs are limited to ${DEMO_LIMITS.PER_ORG_MEMBERS} members.`,
      };
    }
  } else if (type === "org" && userId) {
    const count = await prisma.organization.count({ where: { ownerId: userId } });
    if (count >= DEMO_LIMITS.PER_USER_ORGS) {
      return {
        ok: false,
        error: `Demo accounts are limited to ${DEMO_LIMITS.PER_USER_ORGS} organizations.`,
      };
    }
  }

  return { ok: true };
}

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

  function utcEntry(offsetDays: number, localHHMM: string, durationMin: number) {
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

// ─── Tasks ────────────────────────────────────────────────────────────────────
// [name, color, durationMin, description, role_key, preferredStart, minWait, maxWait]

type TaskDef = [string, string, number, string, string, string, number, number];

const TASKS: TaskDef[] = [
  // ── Daily Operations ───────────────────────────────────────────────────────
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

  // ── Prep: Fillings ─────────────────────────────────────────────────────────
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

  // ── Prep: Glazes & Fondants ────────────────────────────────────────────────
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

  // ── Recipes: Frappes ──────────────────────────────────────────────────────
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a fresh demo user + fully-seeded "Donut Shop A" org.
 * Returns the user ID and org ID needed to sign the visitor in.
 */
/**
 * Deletes demo orgs + users older than DEMO_TTL_MS.
 * Org must be deleted before User (no cascade on Organization.ownerId).
 */
/**
 * Deletes expired demo users + their orgs.
 *
 * Normal mode:     removes sessions older than DEMO_TTL_MS (24 h).
 * Aggressive mode: removes sessions older than DEMO_JWT_TTL_MS (1 hour, the JWT lifetime)
 *                  — triggered when the global task count nears the soft cap.
 *                  The cutoff is bounded to ≥ DEMO_JWT_TTL_MS so a session is never
 *                  deleted while its JWT is still valid.
 *
 * Org must be deleted before User (no cascade on Organization.ownerId).
 *
 * Note: user.createdAt ≈ demoIssuedAt (the JWT is issued immediately after the user
 * row is created), so it is a reliable proxy for session expiry.
 */
async function cleanupExpiredDemos(aggressive = false) {
  const cutoff = new Date(Date.now() - (aggressive ? DEMO_JWT_TTL_MS : DEMO_TTL_MS));
  const expired = await prisma.user.findMany({
    where: { email: { endsWith: "@demo.friendchise.app" }, createdAt: { lt: cutoff } },
    select: { id: true },
  });
  if (expired.length === 0) return;
  const ids = expired.map((u) => u.id);
  await prisma.organization.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

export async function prepareDemoSession(): Promise<{
  userId: string;
  orgId: string;
}> {
  // Regular cleanup: remove sessions older than 24 h.
  await cleanupExpiredDemos();

  // Check global task count. If near the soft cap, run aggressive cleanup
  // (removes sessions whose JWT has expired, i.e. older than DEMO_JWT_TTL_MS)
  // to free space before accepting new visitors.
  const globalTaskCount = await prisma.task.count({
    where: { organization: { owner: { email: { endsWith: "@demo.friendchise.app" } } } },
  });
  if (globalTaskCount >= DEMO_GLOBAL_TASK_SOFT_CAP) {
    await cleanupExpiredDemos(true);
    const rechecked = await prisma.task.count({
      where: { organization: { owner: { email: { endsWith: "@demo.friendchise.app" } } } },
    });
    if (rechecked >= DEMO_GLOBAL_TASK_HARD_CAP) {
      throw new Error("Demo is under high load. Please try again in 10 minutes.");
    }
  }

  // Count only rows whose JWT could still be valid (createdAt within the last
  // DEMO_JWT_TTL_MS). Rows outside that window have expired JWTs and should not
  // consume a concurrency slot even if cleanup hasn't run yet.
  const active = await prisma.user.count({
    where: {
      email: { endsWith: "@demo.friendchise.app" },
      createdAt: { gte: new Date(Date.now() - DEMO_JWT_TTL_MS) },
    },
  });
  if (active >= DEMO_MAX_CONCURRENT) {
    throw new Error("Demo capacity reached. Please try again in a few minutes.");
  }

  const demoId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const email = `demo-${demoId}@demo.friendchise.app`;

  // Wrap user creation and seeding in a transaction to ensure atomicity.
  // Timeout raised to 60 s — the seed creates 100+ rows across many tables.
  const result = await prisma.$transaction(async (tx) => {
    const demoUser = await tx.user.create({
      data: {
        email,
        name: "Demo User",
        image: "https://i.pravatar.cc/150?img=3",
      },
    });

    const orgId = await seedDemoOrg(demoUser.id, tx);
    return { userId: demoUser.id, orgId };
  }, { timeout: 60_000 });

  return result;
}

// ─── Internal seeding ────────────────────────────────────────────────────────

/** Returns a random pravatar URL — called once per person so images vary each demo run. */
function randImg(): string {
  return `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70) + 1}`;
}

async function seedDemoOrg(
  ownerId: string,
  tx: Prisma.TransactionClient,
): Promise<string> {
  const { utcEntry } = makeDateUtils("Australia/Sydney");
  const now = new Date();

  // ── Org ────────────────────────────────────────────────────────────────────
  const org = await tx.organization.create({
    data: {
      name: "Donut Shop A",
      ownerId,
      openTimeMin: timeToMin("06:00"),
      closeTimeMin: timeToMin("18:00"),
      timezone: "Australia/Sydney",
      operatingDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
  });

  // ── Roles ──────────────────────────────────────────────────────────────────
  const [
    roleOwner, roleWorker, roleFryer, roleCounter, roleShiftLead, roleTrainee,
  ] = await tx.role
    .createManyAndReturn({
      data: [
        { orgId: org.id, name: "Owner",          key: ROLE_KEYS.OWNER,          color: "#ef4444", isDeletable: false, isDefault: false },
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

  // ── Permissions ────────────────────────────────────────────────────────────
  await tx.permission.createMany({
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
  // Owner = the demo visitor
  const mOwner = await tx.membership.create({
    data: {
      orgId: org.id,
      userId: ownerId,
      workingDays: ["mon", "tue", "wed", "thu", "fri"],
    },
  });

  // Supporting cast as bots (no real user accounts needed)
  const [mJordan, mCasey, mRiley, mAlex] = await Promise.all([
    tx.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Jordan",
        workingDays: ["mon", "tue", "wed", "thu", "fri"],
      },
    }),
    tx.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Casey",
        workingDays: ["tue", "wed", "thu", "fri", "sat"],
      },
    }),
    tx.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Riley",
        workingDays: ["mon", "wed", "fri", "sat"],
      },
    }),
    tx.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Alex",
        workingDays: ["tue", "thu", "sat", "sun"],
      },
    }),
  ]);

  // Unnamed bot slots
  const [
    mBotOpenSlot,
    mBotMorningRunner,
    mBotFryerBackup,
    mBotCounterFloat,
    mBotWeekendFill,
  ] = await Promise.all([
    tx.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Open Slot",
        workingDays: ["mon", "wed", "fri"],
      },
    }),
    tx.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Morning Runner",
        workingDays: ["tue", "thu", "sat"],
      },
    }),
    tx.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Fryer Backup",
        workingDays: ["mon", "tue", "wed"],
      },
    }),
    tx.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Counter Float",
        workingDays: ["wed", "fri", "sun"],
      },
    }),
    tx.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Weekend Fill",
        workingDays: ["sat", "sun"],
      },
    }),
  ]);

  // ── Member Roles ───────────────────────────────────────────────────────────
  await tx.memberRole.createMany({
    data: [
      { membershipId: mOwner.id, roleId: roleOwner.id },
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

  // ── Roster Entries ─────────────────────────────────────────────────────────
  // Seed 4 weeks: prev, current, next, +2 weeks. weekStart = Monday 00:00 UTC.
  {
    const DAY_IDX: Record<string, number> = {
      mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
    };
    function getWeekStart(offsetWeeks: number): Date {
      const d = new Date(now);
      const dow = d.getUTCDay(); // 0=Sun
      d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow) + offsetWeeks * 7);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    const rosterMembers = [
      { id: mOwner.id,           days: ["mon","tue","wed","thu","fri"],     start: 7*60,      end: 15*60      },
      { id: mJordan.id,          days: ["mon","tue","wed","thu","fri"],     start: 6*60,      end: 14*60+30   },
      { id: mCasey.id,           days: ["tue","wed","thu","fri","sat"],     start: 9*60,      end: 17*60+30   },
      { id: mRiley.id,           days: ["mon","wed","fri","sat"],           start: 10*60,     end: 18*60+30   },
      { id: mAlex.id,            days: ["mon","tue","thu"],                 start: 8*60,      end: 14*60      },
      { id: mBotOpenSlot.id,     days: ["mon","wed","fri"],                 start: 6*60,      end: 14*60      },
      { id: mBotMorningRunner.id,days: ["tue","thu","sat"],                 start: 6*60,      end: 14*60+30   },
      { id: mBotFryerBackup.id,  days: ["mon","tue","wed"],                 start: 7*60,      end: 15*60      },
      { id: mBotCounterFloat.id, days: ["wed","fri","sun"],                 start: 9*60,      end: 17*60+30   },
      { id: mBotWeekendFill.id,  days: ["sat","sun"],                      start: 8*60,      end: 16*60      },
    ];
    const rosterData = [];
    for (const weekOffset of [-1, 0, 1, 2]) {
      const weekStart = getWeekStart(weekOffset);
      for (const m of rosterMembers) {
        for (const day of m.days) {
          rosterData.push({
            orgId: org.id,
            membershipId: m.id,
            membershipOrgId: org.id,
            weekStart,
            dayIndex: DAY_IDX[day],
            shiftStartMin: m.start,
            shiftEndMin: m.end,
          });
        }
      }
    }
    await tx.rosterEntry.createMany({ data: rosterData, skipDuplicates: true });
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const roleByKey: Record<string, string> = {
    counter_staff: roleCounter.id,
    fryer_op: roleFryer.id,
    shift_lead: roleShiftLead.id,
    trainee: roleTrainee.id,
    default_member: roleWorker.id,
  };

  const createdTasks = await tx.task.createManyAndReturn({
    data: TASKS.map(([name, color, durationMin, description, , preferredStart, minWait, maxWait]) => ({
      orgId: org.id,
      name,
      color,
      durationMin,
      description,
      preferredStartTimeMin: timeToMin(preferredStart),
      minPeople: 1,
      minWaitDays: minWait,
      maxWaitDays: maxWait,
    })),
  });

  await Promise.all([
    tx.taskEligibility.createMany({
      data: TASKS.map(([name, , , , roleKey]) => ({
        taskId: createdTasks.find((t) => t.name === name)!.id,
        roleId: roleByKey[roleKey]!,
      })),
    }),
    // Required: without this row the task list query (getInheritedTasks)
    // won't find the task — it only looks up TaskInheritance rows.
    tx.taskInheritance.createMany({
      data: createdTasks.map((task) => ({ taskId: task.id, orgId: org.id })),
    }),
  ]);

  const tByName = Object.fromEntries(createdTasks.map((task) => [task.name, task]));
  const t = (name: string) => tByName[name]!;

  // Publish recipe and cleaning tasks as GLOBAL so the franchisee's "Shared Tasks"
  // view is populated and demonstrates the franchise inheritance feature.
  await tx.task.updateMany({
    where: {
      orgId: org.id,
      name: {
        in: [
          "Recipe: White Choc Biscoff Frappe",
          "Recipe: Honeycomb Frappe",
          "Recipe: Coffee Frappe",
          "Recipe: Salted Caramel Frappe",
          "Recipe: Matcha Frappe",
          "Recipe: Chocolate Milkshake",
          "Recipe: Biscoff Custard Shake",
          "Clean Ice Cream Machine",
          "Clean Fryer (End of Day)",
          "Deep Clean Hatco (Hot Jam) Unit",
          "Deep Clean All Fridges",
          "Deep Clean Doughnut Display",
        ],
      },
    },
    data: { scope: TaskScope.GLOBAL },
  });

  // ── Templates ──────────────────────────────────────────────────────────────
  const [tplWeek1, tplWeekend, tplCleaning] = await Promise.all([
    tx.timetableTemplate.create({
      data: { orgId: org.id, name: "Weekday Rotation", cycleLengthDays: 5 },
    }),
    tx.timetableTemplate.create({
      data: { orgId: org.id, name: "Weekend Shift", cycleLengthDays: 2 },
    }),
    tx.timetableTemplate.create({
      data: { orgId: org.id, name: "Weekly Cleaning Schedule", cycleLengthDays: 7 },
    }),
  ]);

  await tx.timetableTemplateEntry.createMany({
    data: [
      // Weekday Rotation (5-day cycle)
      { templateId: tplWeek1.id, taskId: t("Open Shop Checklist").id, dayIndex: 0, startTimeMin: timeToMin("06:00"), endTimeMin: timeToMin("06:30") },
      { templateId: tplWeek1.id, taskId: t("Fry Morning Batches").id, dayIndex: 0, startTimeMin: timeToMin("07:00"), endTimeMin: timeToMin("08:00") },
      { templateId: tplWeek1.id, taskId: t("Mid-Day Stock Check").id, dayIndex: 0, startTimeMin: timeToMin("12:00"), endTimeMin: timeToMin("12:20") },
      { templateId: tplWeek1.id, taskId: t("Fry Afternoon Batches").id, dayIndex: 0, startTimeMin: timeToMin("13:00"), endTimeMin: timeToMin("13:45") },
      { templateId: tplWeek1.id, taskId: t("Close Shop Checklist").id, dayIndex: 0, startTimeMin: timeToMin("17:00"), endTimeMin: timeToMin("17:45") },
      { templateId: tplWeek1.id, taskId: t("Fryer Oil Quality Check").id, dayIndex: 2, startTimeMin: timeToMin("07:30"), endTimeMin: timeToMin("07:45") },
      { templateId: tplWeek1.id, taskId: t("Quality Check — Display & Products").id, dayIndex: 2, startTimeMin: timeToMin("10:00"), endTimeMin: timeToMin("10:20") },
      { templateId: tplWeek1.id, taskId: t("Restock Packaging & Supplies").id, dayIndex: 4, startTimeMin: timeToMin("11:00"), endTimeMin: timeToMin("11:25") },
      // Weekend Shift (2-day cycle)
      { templateId: tplWeekend.id, taskId: t("Open Shop Checklist").id, dayIndex: 0, startTimeMin: timeToMin("06:00"), endTimeMin: timeToMin("06:30") },
      { templateId: tplWeekend.id, taskId: t("Fry Morning Batches").id, dayIndex: 0, startTimeMin: timeToMin("07:00"), endTimeMin: timeToMin("08:00") },
      { templateId: tplWeekend.id, taskId: t("Mid-Day Stock Check").id, dayIndex: 0, startTimeMin: timeToMin("12:00"), endTimeMin: timeToMin("12:20") },
      { templateId: tplWeekend.id, taskId: t("Close Shop Checklist").id, dayIndex: 1, startTimeMin: timeToMin("17:00"), endTimeMin: timeToMin("17:45") },
      // Weekly Cleaning
      { templateId: tplCleaning.id, taskId: t("Clean Ice Cream Machine").id, dayIndex: 0, startTimeMin: timeToMin("14:00"), endTimeMin: timeToMin("14:30") },
      { templateId: tplCleaning.id, taskId: t("Deep Clean Hatco (Hot Jam) Unit").id, dayIndex: 1, startTimeMin: timeToMin("14:30"), endTimeMin: timeToMin("15:15") },
      { templateId: tplCleaning.id, taskId: t("Deep Clean All Fridges").id, dayIndex: 3, startTimeMin: timeToMin("14:00"), endTimeMin: timeToMin("15:00") },
      { templateId: tplCleaning.id, taskId: t("Deep Clean Doughnut Display").id, dayIndex: 4, startTimeMin: timeToMin("15:00"), endTimeMin: timeToMin("15:30") },
      { templateId: tplCleaning.id, taskId: t("Clean & Tidy Storeroom").id, dayIndex: 6, startTimeMin: timeToMin("15:00"), endTimeMin: timeToMin("15:30") },
      { templateId: tplCleaning.id, taskId: t("Clean Fryer (End of Day)").id, dayIndex: 0, startTimeMin: timeToMin("17:30"), endTimeMin: timeToMin("18:10") },
    ],
  });

  // ── Timetable Entries ──────────────────────────────────────────────────────
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
  const entryMembershipIds: string[] = [];

  const add = (
    taskName: string,
    offsetDays: number,
    hhmm: string,
    status: EntryStatus,
    membershipId: string,
  ) => {
    const task = t(taskName);
    entryData.push({
      orgId: org.id,
      taskId: task.id,
      taskName: task.name,
      taskDescription: task.description,
      durationMin: task.durationMin,
      ...utcEntry(offsetDays, hhmm, task.durationMin),
      status,
    });
    entryMembershipIds.push(membershipId);
  };

  // ── 30 days of past history ────────────────────────────────────────────────
  // Day -30
  add("Open Shop Checklist", -30, "06:00", EntryStatus.DONE, mJordan.id);
  add("Fry Morning Batches", -30, "07:00", EntryStatus.DONE, mCasey.id);
  add("Make Custard Cream", -30, "06:30", EntryStatus.DONE, mBotFryerBackup.id);
  add("Close Shop Checklist", -30, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -29
  add("Open Shop Checklist", -29, "06:00", EntryStatus.DONE, mBotMorningRunner.id);
  add("Fry Morning Batches", -29, "07:00", EntryStatus.DONE, mCasey.id);
  add("Fryer Oil Quality Check", -29, "07:30", EntryStatus.DONE, mCasey.id);
  add("Mid-Day Stock Check", -29, "12:00", EntryStatus.DONE, mBotCounterFloat.id);
  add("Close Shop Checklist", -29, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -28
  add("Open Shop Checklist", -28, "06:00", EntryStatus.DONE, mJordan.id);
  add("Fry Morning Batches", -28, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Make Biscoff Filling", -28, "07:00", EntryStatus.DONE, mCasey.id);
  add("Clean Ice Cream Machine", -28, "14:00", EntryStatus.DONE, mBotCounterFloat.id);
  add("Close Shop Checklist", -28, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -27
  add("Open Shop Checklist", -27, "06:00", EntryStatus.DONE, mBotOpenSlot.id);
  add("Fry Morning Batches", -27, "07:00", EntryStatus.DONE, mCasey.id);
  add("Deep Clean Hatco (Hot Jam) Unit", -27, "14:30", EntryStatus.DONE, mCasey.id);
  add("Close Shop Checklist", -27, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -26
  add("Open Shop Checklist", -26, "06:00", EntryStatus.DONE, mJordan.id);
  add("Fry Morning Batches", -26, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Fry Afternoon Batches", -26, "13:00", EntryStatus.DONE, mCasey.id);
  add("Restock Packaging & Supplies", -26, "11:00", EntryStatus.DONE, mBotMorningRunner.id);
  add("Close Shop Checklist", -26, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -25
  add("Open Shop Checklist", -25, "06:00", EntryStatus.DONE, mBotMorningRunner.id);
  add("Fry Morning Batches", -25, "07:00", EntryStatus.DONE, mCasey.id);
  add("Quality Check — Display & Products", -25, "10:00", EntryStatus.DONE, mJordan.id);
  add("Mid-Day Stock Check", -25, "12:00", EntryStatus.DONE, mBotCounterFloat.id);
  add("Close Shop Checklist", -25, "17:00", EntryStatus.SKIPPED, mBotWeekendFill.id);

  // Day -24
  add("Open Shop Checklist", -24, "06:00", EntryStatus.DONE, mAlex.id);
  add("Fry Morning Batches", -24, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Make Choc Custard Cream", -24, "06:45", EntryStatus.DONE, mCasey.id);
  add("Close Shop Checklist", -24, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -23
  add("Open Shop Checklist", -23, "06:00", EntryStatus.DONE, mJordan.id);
  add("Fry Morning Batches", -23, "07:00", EntryStatus.DONE, mCasey.id);
  add("Prepare Classic Glaze", -23, "07:30", EntryStatus.DONE, mCasey.id);
  add("Close Shop Checklist", -23, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -22
  add("Open Shop Checklist", -22, "06:00", EntryStatus.DONE, mBotOpenSlot.id);
  add("Fry Morning Batches", -22, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Fryer Oil Quality Check", -22, "07:30", EntryStatus.DONE, mCasey.id);
  add("Clean Ice Cream Machine", -22, "14:00", EntryStatus.DONE, mBotCounterFloat.id);
  add("Close Shop Checklist", -22, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -21
  add("Open Shop Checklist", -21, "06:00", EntryStatus.DONE, mJordan.id);
  add("Fry Morning Batches", -21, "07:00", EntryStatus.DONE, mCasey.id);
  add("Make Nutella Filling", -21, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Deep Clean All Fridges", -21, "14:00", EntryStatus.DONE, mRiley.id);
  add("Close Shop Checklist", -21, "17:00", EntryStatus.DONE, mBotWeekendFill.id);

  // Day -20
  add("Open Shop Checklist", -20, "06:00", EntryStatus.DONE, mBotMorningRunner.id);
  add("Fry Morning Batches", -20, "07:00", EntryStatus.DONE, mCasey.id);
  add("Fry Afternoon Batches", -20, "13:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Deep Clean Doughnut Display", -20, "15:00", EntryStatus.DONE, mJordan.id);
  add("Close Shop Checklist", -20, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -19
  add("Open Shop Checklist", -19, "06:00", EntryStatus.DONE, mAlex.id);
  add("Fry Morning Batches", -19, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Mid-Day Stock Check", -19, "12:00", EntryStatus.DONE, mBotCounterFloat.id);
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
  add("Fry Morning Batches", -17, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Fryer Oil Quality Check", -17, "07:30", EntryStatus.DONE, mBotFryerBackup.id);
  add("Quality Check — Display & Products", -17, "10:00", EntryStatus.DONE, mRiley.id);
  add("Close Shop Checklist", -17, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -16
  add("Open Shop Checklist", -16, "06:00", EntryStatus.DONE, mBotMorningRunner.id);
  add("Fry Morning Batches", -16, "07:00", EntryStatus.DONE, mCasey.id);
  add("Prepare Biscoff Fondant", -16, "07:30", EntryStatus.DONE, mCasey.id);
  add("Close Shop Checklist", -16, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -15
  add("Open Shop Checklist", -15, "06:00", EntryStatus.DONE, mAlex.id);
  add("Fry Morning Batches", -15, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Make Raspberry Cheesecake Filling", -15, "07:00", EntryStatus.DONE, mCasey.id);
  add("Restock Packaging & Supplies", -15, "11:00", EntryStatus.DONE, mBotMorningRunner.id);
  add("Close Shop Checklist", -15, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -14
  add("Open Shop Checklist", -14, "06:00", EntryStatus.DONE, mBotOpenSlot.id);
  add("Fry Morning Batches", -14, "07:00", EntryStatus.DONE, mCasey.id);
  add("Clean Ice Cream Machine", -14, "14:00", EntryStatus.DONE, mBotCounterFloat.id);
  add("Close Shop Checklist", -14, "17:00", EntryStatus.SKIPPED, mBotWeekendFill.id);

  // Day -13
  add("Open Shop Checklist", -13, "06:00", EntryStatus.DONE, mJordan.id);
  add("Fry Morning Batches", -13, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Make Custard Cream", -13, "06:30", EntryStatus.DONE, mCasey.id);
  add("Fry Afternoon Batches", -13, "13:00", EntryStatus.DONE, mCasey.id);
  add("Deep Clean Hatco (Hot Jam) Unit", -13, "14:30", EntryStatus.DONE, mCasey.id);
  add("Close Shop Checklist", -13, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -12
  add("Open Shop Checklist", -12, "06:00", EntryStatus.DONE, mBotMorningRunner.id);
  add("Fry Morning Batches", -12, "07:00", EntryStatus.DONE, mCasey.id);
  add("Fryer Oil Quality Check", -12, "07:30", EntryStatus.DONE, mCasey.id);
  add("Prepare Chocolate Fondant", -12, "07:30", EntryStatus.DONE, mCasey.id);
  add("Mid-Day Stock Check", -12, "12:00", EntryStatus.DONE, mBotCounterFloat.id);
  add("Close Shop Checklist", -12, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -11
  add("Open Shop Checklist", -11, "06:00", EntryStatus.DONE, mAlex.id);
  add("Fry Morning Batches", -11, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Quality Check — Display & Products", -11, "10:00", EntryStatus.DONE, mRiley.id);
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
  add("Open Shop Checklist", -8, "06:00", EntryStatus.DONE, mBotMorningRunner.id);
  add("Fry Morning Batches", -8, "07:00", EntryStatus.DONE, mCasey.id);
  add("Deep Clean Doughnut Display", -8, "15:00", EntryStatus.DONE, mJordan.id);
  add("Close Shop Checklist", -8, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -7
  add("Open Shop Checklist", -7, "06:00", EntryStatus.DONE, mAlex.id);
  add("Fry Morning Batches", -7, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Fryer Oil Quality Check", -7, "07:30", EntryStatus.DONE, mBotFryerBackup.id);
  add("Mid-Day Stock Check", -7, "12:00", EntryStatus.DONE, mBotCounterFloat.id);
  add("Shift Handover", -7, "13:00", EntryStatus.DONE, mRiley.id);
  add("Close Shop Checklist", -7, "17:00", EntryStatus.SKIPPED, mBotWeekendFill.id);

  // Day -6
  add("Open Shop Checklist", -6, "06:00", EntryStatus.DONE, mBotOpenSlot.id);
  add("Fry Morning Batches", -6, "07:00", EntryStatus.DONE, mCasey.id);
  add("Make Choc Custard Cream", -6, "06:45", EntryStatus.DONE, mCasey.id);
  add("Clean Ice Cream Machine", -6, "14:00", EntryStatus.DONE, mBotCounterFloat.id);
  add("Clean & Tidy Storeroom", -6, "15:00", EntryStatus.DONE, mRiley.id);
  add("Close Shop Checklist", -6, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -5
  add("Open Shop Checklist", -5, "06:00", EntryStatus.DONE, mJordan.id);
  add("Fry Morning Batches", -5, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Prepare Classic Glaze", -5, "07:30", EntryStatus.DONE, mCasey.id);
  add("Quality Check — Display & Products", -5, "10:00", EntryStatus.DONE, mJordan.id);
  add("Close Shop Checklist", -5, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -4
  add("Open Shop Checklist", -4, "06:00", EntryStatus.DONE, mBotMorningRunner.id);
  add("Fry Morning Batches", -4, "07:00", EntryStatus.DONE, mCasey.id);
  add("Fry Afternoon Batches", -4, "13:00", EntryStatus.DONE, mCasey.id);
  add("Deep Clean Hatco (Hot Jam) Unit", -4, "14:30", EntryStatus.DONE, mCasey.id);
  add("Close Shop Checklist", -4, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -3
  add("Open Shop Checklist", -3, "06:00", EntryStatus.DONE, mAlex.id);
  add("Fry Morning Batches", -3, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Make Custard Cream", -3, "06:30", EntryStatus.DONE, mCasey.id);
  add("Restock Packaging & Supplies", -3, "11:00", EntryStatus.DONE, mBotMorningRunner.id);
  add("Close Shop Checklist", -3, "17:00", EntryStatus.DONE, mJordan.id);

  // Day -2
  add("Open Shop Checklist", -2, "06:00", EntryStatus.DONE, mBotOpenSlot.id);
  add("Fry Morning Batches", -2, "07:00", EntryStatus.DONE, mCasey.id);
  add("Fryer Oil Quality Check", -2, "07:30", EntryStatus.DONE, mCasey.id);
  add("Mid-Day Stock Check", -2, "12:00", EntryStatus.DONE, mBotCounterFloat.id);
  add("Clean Fryer (End of Day)", -2, "17:30", EntryStatus.DONE, mCasey.id);
  add("Close Shop Checklist", -2, "17:00", EntryStatus.DONE, mRiley.id);

  // Day -1
  add("Open Shop Checklist", -1, "06:00", EntryStatus.DONE, mJordan.id);
  add("Fry Morning Batches", -1, "07:00", EntryStatus.DONE, mBotFryerBackup.id);
  add("Make Nutella Filling", -1, "07:00", EntryStatus.DONE, mCasey.id);
  add("Prepare Biscoff Fondant", -1, "07:30", EntryStatus.DONE, mCasey.id);
  add("Quality Check — Display & Products", -1, "10:00", EntryStatus.DONE, mRiley.id);
  add("Close Shop Checklist", -1, "17:00", EntryStatus.DONE, mJordan.id);

  // ── Today ──────────────────────────────────────────────────────────────────
  add("Open Shop Checklist", 0, "06:00", EntryStatus.DONE, mBotMorningRunner.id);
  add("Make Custard Cream", 0, "06:30", EntryStatus.DONE, mCasey.id);
  add("Fry Morning Batches", 0, "07:00", EntryStatus.IN_PROGRESS, mCasey.id);
  add("Fryer Oil Quality Check", 0, "07:30", EntryStatus.TODO, mCasey.id);
  add("Mid-Day Stock Check", 0, "12:00", EntryStatus.TODO, mBotCounterFloat.id);
  add("Shift Handover", 0, "13:00", EntryStatus.TODO, mJordan.id);
  add("Fry Afternoon Batches", 0, "13:00", EntryStatus.TODO, mBotFryerBackup.id);
  add("Close Shop Checklist", 0, "17:00", EntryStatus.TODO, mRiley.id);

  // ── Future: Days +1 to +14 ─────────────────────────────────────────────────
  // +1
  add("Open Shop Checklist", 1, "06:00", EntryStatus.TODO, mJordan.id);
  add("Fry Morning Batches", 1, "07:00", EntryStatus.TODO, mBotFryerBackup.id);
  add("Make Biscoff Filling", 1, "07:00", EntryStatus.TODO, mCasey.id);
  add("Quality Check — Display & Products", 1, "10:00", EntryStatus.TODO, mRiley.id);
  add("Close Shop Checklist", 1, "17:00", EntryStatus.TODO, mBotOpenSlot.id);

  // +2
  add("Open Shop Checklist", 2, "06:00", EntryStatus.TODO, mBotMorningRunner.id);
  add("Fry Morning Batches", 2, "07:00", EntryStatus.TODO, mCasey.id);
  add("Prepare Classic Glaze", 2, "07:30", EntryStatus.TODO, mCasey.id);
  add("Mid-Day Stock Check", 2, "12:00", EntryStatus.TODO, mBotCounterFloat.id);
  add("Clean Ice Cream Machine", 2, "14:00", EntryStatus.TODO, mBotCounterFloat.id);

  // +3
  add("Open Shop Checklist", 3, "06:00", EntryStatus.TODO, mAlex.id);
  add("Fry Morning Batches", 3, "07:00", EntryStatus.TODO, mBotFryerBackup.id);
  add("Fryer Oil Quality Check", 3, "07:30", EntryStatus.TODO, mBotFryerBackup.id);
  add("Deep Clean Hatco (Hot Jam) Unit", 3, "14:30", EntryStatus.TODO, mCasey.id);
  add("Close Shop Checklist", 3, "17:00", EntryStatus.TODO, mJordan.id);

  // +4
  add("Open Shop Checklist", 4, "06:00", EntryStatus.TODO, mBotOpenSlot.id);
  add("Fry Morning Batches", 4, "07:00", EntryStatus.TODO, mCasey.id);
  add("Make Choc Custard Cream", 4, "06:45", EntryStatus.TODO, mCasey.id);
  add("Restock Packaging & Supplies", 4, "11:00", EntryStatus.TODO, mBotMorningRunner.id);
  add("Close Shop Checklist", 4, "17:00", EntryStatus.TODO, mRiley.id);

  // +5
  add("Open Shop Checklist", 5, "06:00", EntryStatus.TODO, mJordan.id);
  add("Fry Morning Batches", 5, "07:00", EntryStatus.TODO, mBotFryerBackup.id);
  add("Make Peanut Butter Filling", 5, "07:00", EntryStatus.TODO, mCasey.id);
  add("Fry Afternoon Batches", 5, "13:00", EntryStatus.TODO, mCasey.id);
  add("Deep Clean All Fridges", 5, "14:00", EntryStatus.TODO, mRiley.id);
  add("Close Shop Checklist", 5, "17:00", EntryStatus.TODO, mBotWeekendFill.id);

  // +6
  add("Open Shop Checklist", 6, "06:00", EntryStatus.TODO, mBotMorningRunner.id);
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
  add("Quality Check — Display & Products", 8, "10:00", EntryStatus.TODO, mRiley.id);
  add("Clean Ice Cream Machine", 8, "14:00", EntryStatus.TODO, mBotCounterFloat.id);
  add("Close Shop Checklist", 8, "17:00", EntryStatus.TODO, mRiley.id);

  // +9
  add("Open Shop Checklist", 9, "06:00", EntryStatus.TODO, mBotMorningRunner.id);
  add("Fry Morning Batches", 9, "07:00", EntryStatus.TODO, mBotFryerBackup.id);
  add("Mid-Day Stock Check", 9, "12:00", EntryStatus.TODO, mBotCounterFloat.id);
  add("Shift Handover", 9, "13:00", EntryStatus.TODO, mJordan.id);
  add("Close Shop Checklist", 9, "17:00", EntryStatus.TODO, mBotWeekendFill.id);

  // +10
  add("Open Shop Checklist", 10, "06:00", EntryStatus.TODO, mAlex.id);
  add("Fry Morning Batches", 10, "07:00", EntryStatus.TODO, mCasey.id);
  add("Make Raspberry Cheesecake Filling", 10, "07:00", EntryStatus.TODO, mCasey.id);
  add("Fry Afternoon Batches", 10, "13:00", EntryStatus.TODO, mBotFryerBackup.id);
  add("Close Shop Checklist", 10, "17:00", EntryStatus.TODO, mJordan.id);

  // +11
  add("Open Shop Checklist", 11, "06:00", EntryStatus.TODO, mBotOpenSlot.id);
  add("Fry Morning Batches", 11, "07:00", EntryStatus.TODO, mBotFryerBackup.id);
  add("Fryer Oil Quality Check", 11, "07:30", EntryStatus.TODO, mBotFryerBackup.id);
  add("Restock Packaging & Supplies", 11, "11:00", EntryStatus.TODO, mBotMorningRunner.id);
  add("Close Shop Checklist", 11, "17:00", EntryStatus.TODO, mRiley.id);

  // +12
  add("Open Shop Checklist", 12, "06:00", EntryStatus.TODO, mJordan.id);
  add("Fry Morning Batches", 12, "07:00", EntryStatus.TODO, mCasey.id);
  add("Clean Fryer (End of Day)", 12, "17:30", EntryStatus.TODO, mCasey.id);
  add("Close Shop Checklist", 12, "17:00", EntryStatus.TODO, mJordan.id);

  // +13
  add("Open Shop Checklist", 13, "06:00", EntryStatus.TODO, mBotMorningRunner.id);
  add("Fry Morning Batches", 13, "07:00", EntryStatus.TODO, mBotFryerBackup.id);
  add("Quality Check — Display & Products", 13, "10:00", EntryStatus.TODO, mRiley.id);
  add("Deep Clean Hatco (Hot Jam) Unit", 13, "14:30", EntryStatus.TODO, mCasey.id);
  add("Close Shop Checklist", 13, "17:00", EntryStatus.TODO, mAlex.id);

  // +14
  add("Open Shop Checklist", 14, "06:00", EntryStatus.TODO, mBotOpenSlot.id);
  add("Fry Morning Batches", 14, "07:00", EntryStatus.TODO, mCasey.id);
  add("Make Custard Cream", 14, "06:30", EntryStatus.TODO, mCasey.id);
  add("Fry Afternoon Batches", 14, "13:00", EntryStatus.TODO, mBotFryerBackup.id);
  add("Close Shop Checklist", 14, "17:00", EntryStatus.TODO, mRiley.id);

  const createdEntries = await tx.timetableEntry.createManyAndReturn({
    data: entryData,
    select: { id: true },
  });
  await tx.timetableEntryAssignee.createMany({
    data: createdEntries.map(({ id }, i) => ({
      timetableEntryId: id,
      membershipId: entryMembershipIds[i]!,
    })),
  });

  // ── Franchise Tokens ───────────────────────────────────────────────────────
  await tx.franchiseToken.createMany({
    data: [
      {
        orgId: org.id,
        invitedEmail: "owner@downtown-donuts.com.au",
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
      {
        orgId: org.id,
        invitedEmail: "franchise@northside-rings.com.au",
        expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      },
      {
        orgId: org.id,
        invitedEmail: "ops@southbay-donuts.com.au",
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // ── Conversion Tool ────────────────────────────────────────────────────────
  // Set: "Donut Production" — all rates expressed per Donut Ring (from side),
  // except the Dough → Cake Flour cross-rate which models the flour sub-recipe.
  const [
    iRing, iDough, iCakeFlour, iYeast, iSalt,
    iOil, iCustard, iBiscoff, iRaspJam, iChocFondant,
    iGlaze, iHundreds, iBiscoffCrumb, iWhipCream, iCocoa,
  ] = await Promise.all([
    tx.toolItem.create({ data: { orgId: org.id, name: "Donut Ring",          unit: "each" } }),
    tx.toolItem.create({ data: { orgId: org.id, name: "Dough",               unit: "g"    } }),
    tx.toolItem.create({ data: { orgId: org.id, name: "Cake Flour",          unit: "g"    } }),
    tx.toolItem.create({ data: { orgId: org.id, name: "Yeast",               unit: "g"    } }),
    tx.toolItem.create({ data: { orgId: org.id, name: "Salt",                unit: "g"    } }),
    tx.toolItem.create({ data: { orgId: org.id, name: "Fry Oil",             unit: "L"    } }),
    tx.toolItem.create({ data: { orgId: org.id, name: "Custard Cream",       unit: "g"    } }),
    tx.toolItem.create({ data: { orgId: org.id, name: "Biscoff Spread",      unit: "g"    } }),
    tx.toolItem.create({ data: { orgId: org.id, name: "Raspberry Jam",       unit: "g"    } }),
    tx.toolItem.create({ data: { orgId: org.id, name: "Chocolate Fondant",   unit: "g"    } }),
    tx.toolItem.create({ data: { orgId: org.id, name: "Glaze",               unit: "g"    } }),
    tx.toolItem.create({ data: { orgId: org.id, name: "Hundreds & Thousands",unit: "g"    } }),
    tx.toolItem.create({ data: { orgId: org.id, name: "Biscoff Crumb",       unit: "g"    } }),
    tx.toolItem.create({ data: { orgId: org.id, name: "Whipped Cream",       unit: "g"    } }),
    tx.toolItem.create({ data: { orgId: org.id, name: "Cocoa Powder",        unit: "g"    } }),
  ]);

  const convSet = await tx.conversionSet.create({
    data: { orgId: org.id, name: "Donut Production" },
  });

  await tx.conversionRate.createMany({
    data: [
      // ── Dough components (per ring) ────────────────────────────────────────
      { setId: convSet.id, fromItemId: iRing.id,    toItemId: iDough.id,         fromQty: 1,   toQty: 75   }, // 75g dough per ring
      { setId: convSet.id, fromItemId: iRing.id,    toItemId: iCakeFlour.id,     fromQty: 1,   toQty: 45   }, // 45g flour per ring
      { setId: convSet.id, fromItemId: iRing.id,    toItemId: iYeast.id,         fromQty: 100, toQty: 5    }, // 5g yeast per 100 rings
      { setId: convSet.id, fromItemId: iRing.id,    toItemId: iSalt.id,          fromQty: 100, toQty: 4    }, // 4g salt per 100 rings
      // ── Frying (per ring) ──────────────────────────────────────────────────
      { setId: convSet.id, fromItemId: iRing.id,    toItemId: iOil.id,           fromQty: 12,  toQty: 1    }, // 1L oil per 12 rings
      // ── Fillings (per ring) ────────────────────────────────────────────────
      { setId: convSet.id, fromItemId: iRing.id,    toItemId: iCustard.id,       fromQty: 1,   toQty: 35   }, // 35g custard per ring
      { setId: convSet.id, fromItemId: iRing.id,    toItemId: iBiscoff.id,       fromQty: 1,   toQty: 30   }, // 30g biscoff per ring
      { setId: convSet.id, fromItemId: iRing.id,    toItemId: iRaspJam.id,       fromQty: 1,   toQty: 25   }, // 25g jam per ring
      // ── Coatings (per ring) ────────────────────────────────────────────────
      { setId: convSet.id, fromItemId: iRing.id,    toItemId: iChocFondant.id,   fromQty: 1,   toQty: 40   }, // 40g chocolate fondant per ring
      { setId: convSet.id, fromItemId: iRing.id,    toItemId: iGlaze.id,         fromQty: 1,   toQty: 20   }, // 20g glaze per ring
      // ── Toppings (per ring) ────────────────────────────────────────────────
      { setId: convSet.id, fromItemId: iRing.id,    toItemId: iHundreds.id,      fromQty: 1,   toQty: 8    }, // 8g sprinkles per ring
      { setId: convSet.id, fromItemId: iRing.id,    toItemId: iBiscoffCrumb.id,  fromQty: 1,   toQty: 10   }, // 10g biscoff crumb per ring
      { setId: convSet.id, fromItemId: iRing.id,    toItemId: iWhipCream.id,     fromQty: 1,   toQty: 15   }, // 15g whipped cream per ring
      { setId: convSet.id, fromItemId: iRing.id,    toItemId: iCocoa.id,         fromQty: 1,   toQty: 5    }, // 5g cocoa per ring
      // ── Cross-rate: Dough sub-recipe ───────────────────────────────────────
      { setId: convSet.id, fromItemId: iDough.id,   toItemId: iCakeFlour.id,     fromQty: 100, toQty: 60   }, // 60g flour per 100g dough
    ],
  });

  // ── Conversion Templates ───────────────────────────────────────────────────
  const [tplDefault, tplMorning, tplWeekday, tplWeekendBatch, tplEvent] = await Promise.all([
    tx.conversionTemplate.create({ data: { setId: convSet.id, name: "Default"            } }),
    tx.conversionTemplate.create({ data: { setId: convSet.id, name: "Morning Batch"      } }),
    tx.conversionTemplate.create({ data: { setId: convSet.id, name: "Weekday Batch"      } }),
    tx.conversionTemplate.create({ data: { setId: convSet.id, name: "Weekend Batch"      } }),
    tx.conversionTemplate.create({ data: { setId: convSet.id, name: "Event / Catering"   } }),
  ]);

  // pinnedOutput bitmask — 1=from, 2=to, 3=both
  await tx.conversionTemplateEntry.createMany({
    data: [
      // Default — blank canvas with all items visible; ring qty left null so
      // the user enters their own number when they first open the set
      { templateId: tplDefault.id,  itemId: iRing.id,         quantity: null, pinnedOutput: 1 },
      { templateId: tplDefault.id,  itemId: iDough.id,        quantity: null, pinnedOutput: 2 },
      { templateId: tplDefault.id,  itemId: iCakeFlour.id,    quantity: null, pinnedOutput: 2 },
      { templateId: tplDefault.id,  itemId: iYeast.id,        quantity: null, pinnedOutput: 2 },
      { templateId: tplDefault.id,  itemId: iOil.id,          quantity: null, pinnedOutput: 2 },
      { templateId: tplDefault.id,  itemId: iCustard.id,      quantity: null, pinnedOutput: 2 },
      { templateId: tplDefault.id,  itemId: iBiscoff.id,      quantity: null, pinnedOutput: 2 },
      { templateId: tplDefault.id,  itemId: iRaspJam.id,      quantity: null, pinnedOutput: 2 },
      { templateId: tplDefault.id,  itemId: iChocFondant.id,  quantity: null, pinnedOutput: 2 },
      { templateId: tplDefault.id,  itemId: iGlaze.id,        quantity: null, pinnedOutput: 2 },
      { templateId: tplMorning.id, itemId: iRing.id,        quantity: 120, pinnedOutput: 1 },
      { templateId: tplMorning.id, itemId: iDough.id,        quantity: null, pinnedOutput: 2 },
      { templateId: tplMorning.id, itemId: iCakeFlour.id,    quantity: null, pinnedOutput: 2 },
      { templateId: tplMorning.id, itemId: iYeast.id,        quantity: null, pinnedOutput: 2 },
      { templateId: tplMorning.id, itemId: iOil.id,          quantity: null, pinnedOutput: 2 },
      { templateId: tplMorning.id, itemId: iCustard.id,      quantity: null, pinnedOutput: 2 },
      { templateId: tplMorning.id, itemId: iBiscoff.id,      quantity: null, pinnedOutput: 2 },
      { templateId: tplMorning.id, itemId: iGlaze.id,        quantity: null, pinnedOutput: 2 },

      // Weekday Batch — 80 rings; lean batch tracking only essentials
      { templateId: tplWeekday.id, itemId: iRing.id,         quantity: 80,  pinnedOutput: 1 },
      { templateId: tplWeekday.id, itemId: iDough.id,        quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekday.id, itemId: iCakeFlour.id,    quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekday.id, itemId: iOil.id,          quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekday.id, itemId: iCustard.id,      quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekday.id, itemId: iRaspJam.id,      quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekday.id, itemId: iGlaze.id,        quantity: null, pinnedOutput: 2 },

      // Weekend Batch — 200 rings; full output including toppings
      { templateId: tplWeekendBatch.id, itemId: iRing.id,         quantity: 200, pinnedOutput: 1 },
      { templateId: tplWeekendBatch.id, itemId: iDough.id,        quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekendBatch.id, itemId: iCakeFlour.id,    quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekendBatch.id, itemId: iYeast.id,        quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekendBatch.id, itemId: iOil.id,          quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekendBatch.id, itemId: iCustard.id,      quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekendBatch.id, itemId: iBiscoff.id,      quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekendBatch.id, itemId: iChocFondant.id,  quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekendBatch.id, itemId: iGlaze.id,        quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekendBatch.id, itemId: iHundreds.id,     quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekendBatch.id, itemId: iBiscoffCrumb.id, quantity: null, pinnedOutput: 2 },
      { templateId: tplWeekendBatch.id, itemId: iWhipCream.id,    quantity: null, pinnedOutput: 2 },

      // Event / Catering — 360 rings; everything tracked
      { templateId: tplEvent.id,   itemId: iRing.id,         quantity: 360, pinnedOutput: 1 },
      { templateId: tplEvent.id,   itemId: iDough.id,        quantity: null, pinnedOutput: 2 },
      { templateId: tplEvent.id,   itemId: iCakeFlour.id,    quantity: null, pinnedOutput: 2 },
      { templateId: tplEvent.id,   itemId: iYeast.id,        quantity: null, pinnedOutput: 2 },
      { templateId: tplEvent.id,   itemId: iSalt.id,         quantity: null, pinnedOutput: 2 },
      { templateId: tplEvent.id,   itemId: iOil.id,          quantity: null, pinnedOutput: 2 },
      { templateId: tplEvent.id,   itemId: iCustard.id,      quantity: null, pinnedOutput: 2 },
      { templateId: tplEvent.id,   itemId: iBiscoff.id,      quantity: null, pinnedOutput: 2 },
      { templateId: tplEvent.id,   itemId: iRaspJam.id,      quantity: null, pinnedOutput: 2 },
      { templateId: tplEvent.id,   itemId: iChocFondant.id,  quantity: null, pinnedOutput: 2 },
      { templateId: tplEvent.id,   itemId: iGlaze.id,        quantity: null, pinnedOutput: 2 },
      { templateId: tplEvent.id,   itemId: iHundreds.id,     quantity: null, pinnedOutput: 2 },
      { templateId: tplEvent.id,   itemId: iBiscoffCrumb.id, quantity: null, pinnedOutput: 2 },
      { templateId: tplEvent.id,   itemId: iWhipCream.id,    quantity: null, pinnedOutput: 2 },
      { templateId: tplEvent.id,   itemId: iCocoa.id,        quantity: null, pinnedOutput: 2 },
    ],
  });

  // ── Tags ───────────────────────────────────────────────────────────────────
  const [tagRecipe, tagCleaning, tagCritical, tagOps] = await Promise.all([
    tx.tag.create({ data: { orgId: org.id, name: "Recipe", color: "#8B5CF6" } }),
    tx.tag.create({ data: { orgId: org.id, name: "Cleaning", color: "#22C55E" } }),
    tx.tag.create({ data: { orgId: org.id, name: "Critical", color: "#EF4444" } }),
    tx.tag.create({ data: { orgId: org.id, name: "Operations", color: "#F59E0B" } }),
  ]);

  await tx.taskTag.createMany({
    data: [
      // Recipe tasks
      { taskId: t("Recipe: White Choc Biscoff Frappe").id, tagId: tagRecipe.id },
      { taskId: t("Recipe: Honeycomb Frappe").id, tagId: tagRecipe.id },
      { taskId: t("Recipe: Coffee Frappe").id, tagId: tagRecipe.id },
      { taskId: t("Recipe: Salted Caramel Frappe").id, tagId: tagRecipe.id },
      { taskId: t("Recipe: Matcha Frappe").id, tagId: tagRecipe.id },
      { taskId: t("Recipe: Chocolate Milkshake").id, tagId: tagRecipe.id },
      { taskId: t("Recipe: Biscoff Custard Shake").id, tagId: tagRecipe.id },
      // Cleaning tasks
      { taskId: t("Clean Ice Cream Machine").id, tagId: tagCleaning.id },
      { taskId: t("Deep Clean Hatco (Hot Jam) Unit").id, tagId: tagCleaning.id },
      { taskId: t("Deep Clean All Fridges").id, tagId: tagCleaning.id },
      { taskId: t("Deep Clean Doughnut Display").id, tagId: tagCleaning.id },
      { taskId: t("Clean & Tidy Storeroom").id, tagId: tagCleaning.id },
      { taskId: t("Clean Fryer (End of Day)").id, tagId: tagCleaning.id },
      { taskId: t("Clean Fondant Bain-Marie").id, tagId: tagCleaning.id },
      // Critical tasks
      { taskId: t("Fry Morning Batches").id, tagId: tagCritical.id },
      { taskId: t("Fryer Oil Quality Check").id, tagId: tagCritical.id },
      // Operations
      { taskId: t("Open Shop Checklist").id, tagId: tagOps.id },
      { taskId: t("Close Shop Checklist").id, tagId: tagOps.id },
      { taskId: t("Shift Handover").id, tagId: tagOps.id },
    ],
  });

  // ── Task Comments ──────────────────────────────────────────────────────────
  // Each randImg() call produces a different random pravatar — varies per demo run
  const IMG_JORDAN = randImg();
  const IMG_CASEY = randImg();
  const IMG_RILEY = randImg();
  const IMG_ALEX = randImg();
  const IMG_OWNER = randImg();

  // --- Open Shop Checklist ---
  const cOpenJordan = await tx.taskComment.create({
    data: {
      taskId: t("Open Shop Checklist").id,
      orgId: org.id,
      authorId: null,
      authorName: "Jordan",
      authorImage: IMG_JORDAN,
      content:
        "Make sure the fryer is fully up to temp before opening — takes extra time on cold mornings. Check the thermometer, not just the indicator light.",
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    },
  });
  // Reply from Casey
  await tx.taskComment.create({
    data: {
      taskId: t("Open Shop Checklist").id,
      orgId: org.id,
      authorId: null,
      authorName: "Casey",
      authorImage: IMG_CASEY,
      content: "Also double-check the float in the till. Had it short by $20 last Monday.",
      parentId: cOpenJordan.id,
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 40 * 60 * 1000),
    },
  });
  const cOpenRiley = await tx.taskComment.create({
    data: {
      taskId: t("Open Shop Checklist").id,
      orgId: org.id,
      authorId: null,
      authorName: "Riley",
      authorImage: IMG_RILEY,
      content:
        "POS needs a restart roughly once a week. Best to do it before opening rather than mid-rush.",
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  // --- Fry Morning Batches ---
  // Pinned safety reminder from the owner
  const cFryOwner = await tx.taskComment.create({
    data: {
      taskId: t("Fry Morning Batches").id,
      orgId: org.id,
      authorId: ownerId,
      authorName: "Demo User",
      authorImage: IMG_OWNER,
      content:
        "⚠️ Never exceed 6 rings per side. Oil can overflow and become a fire hazard — this has happened before. Pinning this as a permanent reminder.",
      isPinned: true,
      pinnedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
    },
  });
  const cFryCasey = await tx.taskComment.create({
    data: {
      taskId: t("Fry Morning Batches").id,
      orgId: org.id,
      authorId: null,
      authorName: "Casey",
      authorImage: IMG_CASEY,
      content:
        "If the dough is under-proofed it'll sink in the oil. Do the poke test — press gently and it should spring back slowly.",
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
  });
  // Reply from Jordan
  await tx.taskComment.create({
    data: {
      taskId: t("Fry Morning Batches").id,
      orgId: org.id,
      authorId: null,
      authorName: "Jordan",
      authorImage: IMG_JORDAN,
      content: "Good tip — especially in winter when the proofer runs cold.",
      parentId: cFryCasey.id,
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    },
  });

  // --- Close Shop Checklist ---
  await tx.taskComment.create({
    data: {
      taskId: t("Close Shop Checklist").id,
      orgId: org.id,
      authorId: null,
      authorName: "Riley",
      authorImage: IMG_RILEY,
      content:
        "Don't skip logging wastage in the shift register — management checks this every morning.",
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    },
  });

  // --- Recipe: White Choc Biscoff Frappe ---
  await tx.taskComment.create({
    data: {
      taskId: t("Recipe: White Choc Biscoff Frappe").id,
      orgId: org.id,
      authorId: null,
      authorName: "Alex",
      authorImage: IMG_ALEX,
      content:
        "This one moves fastest on weekends. Get the Biscoff drizzle prepped in advance — you won't have time during the rush.",
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    },
  });

  // Votes from the demo user (the only real user in the session)
  await tx.taskCommentVote.createMany({
    data: [
      { commentId: cOpenJordan.id, userId: ownerId, type: VoteType.UPVOTE },
      { commentId: cOpenRiley.id, userId: ownerId, type: VoteType.UPVOTE },
      { commentId: cFryCasey.id, userId: ownerId, type: VoteType.UPVOTE },
      { commentId: cFryOwner.id, userId: ownerId, type: VoteType.UPVOTE },
    ],
  });

  // ── Franchisee: Downtown Donuts ────────────────────────────────────────────
  // A child org owned by the same demo user. Its tasks are GLOBAL so they
  // appear in Donut Shop A's "Shared Tasks" view and can be inherited.
  const franchisee = await tx.organization.create({
    data: {
      name: "Downtown Donuts",
      ownerId,
      parentId: org.id,
      openTimeMin: timeToMin("07:00"),
      closeTimeMin: timeToMin("17:00"),
      timezone: "Australia/Sydney",
      operatingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
    },
  });

  const [fRoleOwner, fRoleWorker] = await tx.role
    .createManyAndReturn({
      data: [
        { orgId: franchisee.id, name: "Owner",  key: ROLE_KEYS.OWNER,          color: "#ef4444", isDeletable: false, isDefault: false },
        { orgId: franchisee.id, name: "Worker", key: ROLE_KEYS.DEFAULT_MEMBER, color: "#6B7280", isDeletable: false, isDefault: true  },
      ],
    })
    .then((rows) => [
      rows.find((r) => r.key === ROLE_KEYS.OWNER)!,
      rows.find((r) => r.key === ROLE_KEYS.DEFAULT_MEMBER)!,
    ] as const);

  await tx.permission.createMany({
    data: ALL_OWNER_PERMISSIONS.map((action) => ({ roleId: fRoleOwner.id, action })),
    skipDuplicates: true,
  });

  const fOwner = await tx.membership.create({
    data: {
      orgId: franchisee.id,
      userId: ownerId,
      workingDays: ["mon", "tue", "wed", "thu", "fri"],
    },
  });

  await tx.memberRole.create({
    data: { membershipId: fOwner.id, roleId: fRoleOwner.id },
  });

  // Franchisee tasks — GLOBAL scope so Donut Shop A can see them as shared tasks
  type FranchiseeTaskDef = [string, string, number, string, string, number, number];
  const FRANCHISEE_TASKS: FranchiseeTaskDef[] = [
    [
      "Morning Opening Procedure",
      "#F59E0B",
      30,
      "**Steps**\n1. Unlock front door and disable alarm\n2. Turn on all equipment (fryer, display warmers, POS)\n3. Check and record temperatures for all refrigerated units\n4. Set up till with correct opening float\n5. Sign off on the opening checklist",
      "07:00",
      0,
      999,
    ],
    [
      "Doughnut Quality Check",
      "#EC4899",
      15,
      "**Before opening the display case:**\n1. Check each tray for freshness — maximum 4 hours since frying\n2. Remove any damaged or stale product\n3. Record the count in the wastage log\n4. Ensure display is clean and lit correctly",
      "07:30",
      0,
      999,
    ],
    [
      "Afternoon Restock",
      "#3B82F6",
      20,
      "**Mid-day restock procedure:**\n1. Check remaining stock vs. projected afternoon sales\n2. Pull fresh product from back if available\n3. Restock packaging (bags, boxes, napkins)\n4. Note any items running low for next morning's order",
      "12:00",
      0,
      999,
    ],
    [
      "End of Day Report",
      "#8B5CF6",
      20,
      "**Complete before closing:**\n1. Tally total sales vs. opening float — note any discrepancies\n2. Record wastage for the day\n3. Complete and submit the shift summary\n4. Brief next shift lead on any issues",
      "16:00",
      0,
      999,
    ],
    [
      "Equipment Temperature Log",
      "#22C55E",
      10,
      "**Record twice daily (opening and mid-day):**\n- Fridge 1 (Fillings): must be 1–4°C\n- Fridge 2 (Display): must be 1–4°C\n- Freezer: must be −18°C or below\n\n_If any unit is out of range, notify the manager immediately._",
      "07:00",
      0,
      1,
    ],
  ];

  const createdFranchiseeTasks = await tx.task.createManyAndReturn({
    data: FRANCHISEE_TASKS.map(([name, color, durationMin, description, preferredStart, minWait, maxWait]) => ({
      orgId: franchisee.id,
      name,
      color,
      durationMin,
      description,
      preferredStartTimeMin: timeToMin(preferredStart),
      minPeople: 1,
      minWaitDays: minWait,
      maxWaitDays: maxWait,
      scope: TaskScope.GLOBAL,
    })),
  });
  await Promise.all([
    tx.taskEligibility.createMany({
      data: createdFranchiseeTasks.map((task) => ({ taskId: task.id, roleId: fRoleWorker.id })),
    }),
    tx.taskInheritance.createMany({
      data: createdFranchiseeTasks.map((task) => ({ taskId: task.id, orgId: franchisee.id })),
    }),
  ]);

  return org.id;
}
