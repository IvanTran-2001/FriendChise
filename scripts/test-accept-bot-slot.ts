 /**
 * Quick smoke test: verifies that acceptBotSlotInvite updates the existing
 * bot membership row in-place instead of creating a new one.
 *
 * Run with:  npx tsx scripts/test-accept-bot-slot.ts
 *
 * Cleans up after itself — safe to run against a dev DB.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { acceptBotSlotInvite } from "../lib/services/invites";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── helpers ──────────────────────────────────────────────────────────────────

function pass(msg: string) {
  console.log(`  ✓  ${msg}`);
}

function fail(msg: string): never {
  console.error(`  ✗  ${msg}`);
  throw new Error(msg);
}

function assert(condition: boolean, msg: string) {
  if (condition) pass(msg);
  else fail(msg);
}

// ─── setup ────────────────────────────────────────────────────────────────────

async function setup() {
  // Unique suffix so parallel runs or reruns don't collide
  const suffix = Date.now();

  // Inviter must exist before the org (org requires an owner)
  const inviter = await prisma.user.create({
    data: {
      name: "Test Inviter",
      email: `inviter-${suffix}@test.local`,
    },
  });

  const org = await prisma.organization.create({
    data: { name: `Test Org ${suffix}`, ownerId: inviter.id },
  });

  // The real user who will fill the bot slot
  const realUser = await prisma.user.create({
    data: {
      name: "Real User",
      email: `real-${suffix}@test.local`,
    },
  });

  // Org needs a default role
  const role = await prisma.role.create({
    data: {
      orgId: org.id,
      name: "Member",
      color: "#888",
      key: `member-${suffix}`,
      isDeletable: false,
      isDefault: true,
    },
  });

  // Inviter membership
  await prisma.membership.create({
    data: { orgId: org.id, userId: inviter.id, workingDays: [] },
  });

  // Bot membership (userId = null)
  const botMembership = await prisma.membership.create({
    data: {
      orgId: org.id,
      userId: null,
      botName: "ShiftBot",
      workingDays: ["mon", "tue"],
      memberRoles: { create: { roleId: role.id } },
    },
  });

  // Invite for the real user to fill the bot slot
  const invite = await prisma.invite.create({
    data: {
      orgId: org.id,
      invitedById: inviter.id,
      recipientId: realUser.id,
      type: "MEMBER",
      orgName: org.name,
      inviterName: inviter.name,
      metadata: {
        roleIds: [role.id],
        workingDays: ["wed", "thu"],
        botMembershipId: botMembership.id,
      },
    },
  });

  return { org, inviter, realUser, role, botMembership, invite };
}

// ─── cleanup ──────────────────────────────────────────────────────────────────

async function cleanup(orgId: string, userIds: string[]) {
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  for (const id of userIds) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
}

// ─── test ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("\nacceptBotSlotInvite — smoke test\n");

  let org, inviter, realUser;
  try {
    const setup_result = await setup();
    org = setup_result.org;
    inviter = setup_result.inviter;
    realUser = setup_result.realUser;
    const role = setup_result.role;
    const botMembership = setup_result.botMembership;
    const invite = setup_result.invite;
    // ── 1. Capture state before ────────────────────────────────────────────
    const membershipsBefore = await prisma.membership.findMany({
      where: { orgId: org.id },
    });
    assert(
      membershipsBefore.length === 2,
      `Before: 2 memberships exist (inviter + bot) — found ${membershipsBefore.length}`,
    );

    const botBefore = membershipsBefore.find((m) => m.id === botMembership.id)!;
    assert(botBefore.userId === null, "Before: bot membership has userId = null");
    assert(botBefore.botName === "ShiftBot", "Before: bot membership has botName");

    // ── 2. Call acceptBotSlotInvite ────────────────────────────────────────
    const result = await acceptBotSlotInvite(invite.id, realUser.id);
    assert(result.ok === true, `acceptBotSlotInvite returned ok: ${result.ok}${!result.ok ? ` — ${result.error}` : ""}`);

    // ── 3. Membership count must NOT have changed ──────────────────────────
    const membershipsAfter = await prisma.membership.findMany({
      where: { orgId: org.id },
    });
    assert(
      membershipsAfter.length === 2,
      `After: still 2 memberships — found ${membershipsAfter.length} (extra means new row was created!)`,
    );

    // ── 4. The existing bot row must be updated in-place ───────────────────
    const updatedMembership = membershipsAfter.find(
      (m) => m.id === botMembership.id,
    );
    assert(!!updatedMembership, "After: same membership ID still exists");
    assert(
      updatedMembership!.userId === realUser.id,
      `After: membership.userId = realUser.id (${realUser.id})`,
    );
    assert(
      updatedMembership!.botName === null,
      "After: botName cleared to null",
    );
    assert(
      JSON.stringify(updatedMembership!.workingDays) ===
        JSON.stringify(["wed", "thu"]),
      `After: workingDays replaced — got ${JSON.stringify(updatedMembership!.workingDays)}`,
    );

    // ── 5. Roles replaced ──────────────────────────────────────────────────
    const roles = await prisma.memberRole.findMany({
      where: { membershipId: botMembership.id },
    });
    assert(roles.length === 1, `After: 1 role assigned — found ${roles.length}`);
    assert(
      roles[0].roleId === role.id,
      "After: correct role applied",
    );

    // ── 6. Invite marked ACCEPTED ──────────────────────────────────────────
    const updatedInvite = await prisma.invite.findUnique({
      where: { id: invite.id },
    });
    assert(
      updatedInvite?.status === "ACCEPTED",
      `After: invite status = ACCEPTED — got ${updatedInvite?.status}`,
    );

    // ── 7. No separate membership created for realUser ─────────────────────
    const realUserMemberships = membershipsAfter.filter(
      (m) => m.userId === realUser.id,
    );
    assert(
      realUserMemberships.length === 1,
      `After: exactly 1 membership for realUser — found ${realUserMemberships.length}`,
    );
    assert(
      realUserMemberships[0].id === botMembership.id,
      "After: realUser's membership is the original bot membership row (same ID)",
    );

    console.log("\nAll assertions passed.\n");
  } catch (e) {
    console.error("\nTest failed:", e instanceof Error ? e.message : e);
    throw e;
  } finally {
    if (org && inviter && realUser) {
      await cleanup(org.id, [inviter.id, realUser.id]);
    }
    await prisma.$disconnect();
  }
}

run().catch(async (e) => {
  console.error("\nUnhandled error:", e);
  await prisma.$disconnect();
  process.exit(1);
});