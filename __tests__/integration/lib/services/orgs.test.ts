/**
 * Integration tests for lib/services/orgs.ts
 *
 * These tests run against the real dev database (seeded fresh before the run).
 * No mocks — every assertion reflects actual DB state.
 */
import { prisma } from "@/lib/prisma";
import { createOrg } from "@/lib/services/orgs";
import { ROLE_KEYS } from "@/lib/rbac";

// Set INTEGRATION_TEST_USER_EMAIL in .env.local to override (default: Casey)
const SEED_USER_EMAIL =
  process.env.INTEGRATION_TEST_USER_EMAIL ?? "integration.test@example.test";

describe("createOrg", () => {
  it("creates an org with Owner and Default Member roles bootstrapped", async () => {
    const user = await prisma.user.findFirstOrThrow({
      where: { email: SEED_USER_EMAIL },
    });

    const { org } = await createOrg(user.id, {
      title: "Integration Test Org",
      timezone: "Australia/Sydney",
    });

    const roles = await prisma.role.findMany({ where: { orgId: org.id } });
    const keys = roles.map((r) => r.key);
    expect(keys).toContain(ROLE_KEYS.OWNER);
    expect(keys).toContain(ROLE_KEYS.DEFAULT_MEMBER);
  });

  it("assigns the creating user as Owner", async () => {
    const user = await prisma.user.findFirstOrThrow({
      where: { email: SEED_USER_EMAIL },
    });

    const { org } = await createOrg(user.id, {
      title: "Integration Test Org 2",
      timezone: "Australia/Sydney",
    });

    const membership = await prisma.membership.findFirst({
      where: { orgId: org.id, userId: user.id },
      include: { memberRoles: { include: { role: true } } },
    });

    expect(membership).not.toBeNull();
    const roleKeys = membership!.memberRoles.map((mr) => mr.role.key);
    expect(roleKeys).toContain(ROLE_KEYS.OWNER);
  });
});
