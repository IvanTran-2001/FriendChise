import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { CreateMembershipInput } from "@/lib/validators/membership";
import type { ServiceResult } from "./types";

export async function createMembership(
  orgId: string,
  data: CreateMembershipInput,
): Promise<ServiceResult<Prisma.MembershipGetPayload<Record<string, never>>>> {
  const role = await prisma.role.findFirst({ where: { id: data.roleId, orgId } });
  if (!role) {
    return { ok: false, error: "Invalid roleId: not found or does not belong to this org", code: "INVALID" };
  }

  const user = await prisma.user.findFirst({ where: { id: data.userId }, select: { id: true } });
  if (!user) {
    return { ok: false, error: "Invalid userId: not found", code: "INVALID" };
  }

  try {
    const membership = await prisma.membership.create({
      data: { orgId, userId: data.userId, roleId: data.roleId },
    });
    return { ok: true, data: membership };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return { ok: false, error: "Membership already exists", code: "CONFLICT" };
      if (e.code === "P2003") return { ok: false, error: "Invalid foreign key reference", code: "INVALID" };
    }
    throw e;
  }
}

export async function deleteMembership(
  orgId: string,
  userId: string,
): Promise<ServiceResult<null>> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerUserId: true },
  });
  if (!org) return { ok: false, error: "Org not found", code: "NOT_FOUND" };

  if (userId === org.ownerUserId) {
    return { ok: false, error: "Cannot remove the organization owner", code: "INVALID" };
  }

  const { count } = await prisma.membership.deleteMany({ where: { userId, orgId } });
  if (count === 0) return { ok: false, error: "Membership not found", code: "NOT_FOUND" };

  return { ok: true, data: null };
}

export async function getMemberships(orgId: string) {
  return prisma.membership.findMany({
    where: { orgId },
    include: {
      user: { select: { id: true, name: true } },
      role: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
