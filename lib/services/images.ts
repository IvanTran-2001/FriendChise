import { prisma } from "@/lib/prisma";

type OrgImageRow = { id: string; storagePath: string; name: string | null; createdAt: Date };

export async function getOrgImages(orgId: string): Promise<OrgImageRow[]> {
  return prisma.orgImage.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: { id: true, storagePath: true, name: true, createdAt: true },
  });
}

export async function addOrgImage(
  orgId: string,
  storagePath: string,
  name?: string,
) {
  return prisma.orgImage.create({
    data: { orgId, storagePath, name },
    select: { id: true, storagePath: true, name: true, createdAt: true },
  });
}

export async function deleteOrgImage(orgId: string, imageId: string) {
  const img = await prisma.orgImage.findFirst({
    where: { id: imageId, orgId },
    select: { storagePath: true },
  });
  if (!img) return null;
  await prisma.orgImage.delete({ where: { id: imageId } });
  return img.storagePath;
}
