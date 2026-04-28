/**
 * Integration tests for lib/services/invites.ts
 *
 * Each test that creates a real membership uses createTempUser() + cleanup in a
 * finally block so the seeded non-member pool is never permanently depleted.
 */
import { prisma } from "@/lib/prisma";
import {
  createMemberInvite,
  acceptMemberInvite,
  declineMemberInvite,
  getInvitesForUser,
  getUnseenInviteCount,
  markInvitesSeen,
} from "@/lib/services/invites";
import { ROLE_KEYS } from "@/lib/rbac";
import {
  getSeedOrg,
  getSeedUser,
  getDefaultRole,
  createTempUser,
  cleanupTempUser,
} from "../../helpers";

describe("createMemberInvite", () => {
  it("creates a PENDING invite for a non-member", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);
    const recipient = await createTempUser();

    try {
      const result = await createMemberInvite(
        org.id,
        null,
        recipient.id,
        [role.id],
        [],
      );

      expect(result.ok).toBe(true);

      const invite = await prisma.invite.findFirst({
        where: { orgId: org.id, recipientId: recipient.id, status: "PENDING" },
      });
      expect(invite).not.toBeNull();
      expect(invite?.type).toBe("MEMBER");
      expect(invite?.orgName).toBe(org.name);
    } finally {
      await cleanupTempUser(recipient.id);
    }
  });

  it("returns CONFLICT when the user is already a member", async () => {
    const org = await getSeedOrg();
    const user = await getSeedUser(); // Casey is already a member
    const role = await getDefaultRole(org.id);

    const result = await createMemberInvite(
      org.id,
      null,
      user.id,
      [role.id],
      [],
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("CONFLICT");
  });

  it("returns CONFLICT when a pending invite already exists for the user", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);
    const recipient = await createTempUser();

    try {
      await createMemberInvite(org.id, null, recipient.id, [role.id], []); // first — OK

      const result = await createMemberInvite(
        org.id,
        null,
        recipient.id,
        [role.id],
        [],
      ); // second — CONFLICT

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("CONFLICT");
    } finally {
      await cleanupTempUser(recipient.id);
    }
  });

  it("returns INVALID when a roleId belongs to a different org", async () => {
    const org = await getSeedOrg();
    const crossOrgRole = await prisma.role.findFirstOrThrow({
      where: { orgId: { not: org.id }, key: ROLE_KEYS.DEFAULT_MEMBER },
    });
    const recipient = await createTempUser();

    try {
      const result = await createMemberInvite(
        org.id,
        null,
        recipient.id,
        [crossOrgRole.id],
        [],
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("INVALID");
    } finally {
      await cleanupTempUser(recipient.id);
    }
  });

  it("returns INVALID when the Owner role is specified", async () => {
    const org = await getSeedOrg();
    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { orgId: org.id, key: ROLE_KEYS.OWNER },
    });
    const recipient = await createTempUser();

    try {
      const result = await createMemberInvite(
        org.id,
        null,
        recipient.id,
        [ownerRole.id],
        [],
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("INVALID");
    } finally {
      await cleanupTempUser(recipient.id);
    }
  });
});

describe("acceptMemberInvite", () => {
  it("creates a membership with roles and marks the invite ACCEPTED", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);
    const recipient = await createTempUser();

    try {
      await createMemberInvite(
        org.id,
        null,
        recipient.id,
        [role.id],
        ["mon", "tue"],
      );

      const invite = await prisma.invite.findFirstOrThrow({
        where: { orgId: org.id, recipientId: recipient.id, status: "PENDING" },
      });

      const result = await acceptMemberInvite(invite.id, recipient.id);

      expect(result.ok).toBe(true);

      const updatedInvite = await prisma.invite.findUnique({
        where: { id: invite.id },
      });
      expect(updatedInvite?.status).toBe("ACCEPTED");

      const membership = await prisma.membership.findUnique({
        where: { userId_orgId: { userId: recipient.id, orgId: org.id } },
        include: { memberRoles: true },
      });
      expect(membership).not.toBeNull();
      expect(membership?.memberRoles.some((mr) => mr.roleId === role.id)).toBe(
        true,
      );
    } finally {
      await cleanupTempUser(recipient.id);
    }
  });

  it("returns CONFLICT when the invite is already handled", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);
    const recipient = await createTempUser();

    try {
      await createMemberInvite(org.id, null, recipient.id, [role.id], []);

      const invite = await prisma.invite.findFirstOrThrow({
        where: { orgId: org.id, recipientId: recipient.id, status: "PENDING" },
      });

      await acceptMemberInvite(invite.id, recipient.id); // first accept — OK

      const result = await acceptMemberInvite(invite.id, recipient.id); // second — CONFLICT

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("CONFLICT");
    } finally {
      await cleanupTempUser(recipient.id);
    }
  });
});

describe("declineMemberInvite", () => {
  it("marks the invite DECLINED without creating a membership", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);
    const recipient = await createTempUser();

    try {
      await createMemberInvite(org.id, null, recipient.id, [role.id], []);

      const invite = await prisma.invite.findFirstOrThrow({
        where: { orgId: org.id, recipientId: recipient.id, status: "PENDING" },
      });

      const result = await declineMemberInvite(invite.id, recipient.id);

      expect(result.ok).toBe(true);

      const updated = await prisma.invite.findUnique({
        where: { id: invite.id },
      });
      expect(updated?.status).toBe("DECLINED");
      expect(updated?.declinedAt).not.toBeNull();

      // No membership was created
      const membership = await prisma.membership.findUnique({
        where: { userId_orgId: { userId: recipient.id, orgId: org.id } },
      });
      expect(membership).toBeNull();
    } finally {
      await cleanupTempUser(recipient.id);
    }
  });

  it("returns NOT_FOUND for an already-handled invite", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);
    const recipient = await createTempUser();

    try {
      await createMemberInvite(org.id, null, recipient.id, [role.id], []);

      const invite = await prisma.invite.findFirstOrThrow({
        where: { orgId: org.id, recipientId: recipient.id, status: "PENDING" },
      });

      await declineMemberInvite(invite.id, recipient.id); // decline once

      const result = await declineMemberInvite(invite.id, recipient.id); // decline again

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("NOT_FOUND");
    } finally {
      await cleanupTempUser(recipient.id);
    }
  });
});

describe("getInvitesForUser + notification helpers", () => {
  it("getInvitesForUser returns PENDING invites for the user", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);
    const recipient = await createTempUser();

    try {
      await createMemberInvite(org.id, null, recipient.id, [role.id], []);

      const invites = await getInvitesForUser(recipient.id);

      expect(invites.length).toBeGreaterThanOrEqual(1);
      expect(
        invites.some((i) => i.orgId === org.id && i.status === "PENDING"),
      ).toBe(true);
    } finally {
      await cleanupTempUser(recipient.id);
    }
  });

  it("getUnseenInviteCount returns 1, markInvitesSeen resets it to 0", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);
    const recipient = await createTempUser();

    try {
      await createMemberInvite(org.id, null, recipient.id, [role.id], []);

      const before = await getUnseenInviteCount(recipient.id);
      expect(before).toBe(1);

      await markInvitesSeen(recipient.id);

      const after = await getUnseenInviteCount(recipient.id);
      expect(after).toBe(0);
    } finally {
      await cleanupTempUser(recipient.id);
    }
  });
});
