import { PermissionAction } from "@prisma/client";
import { makeDateUtils, timeToMin } from "@/lib/demo/provision/helpers";

export const ALL_OWNER_PERMISSIONS = Object.values(PermissionAction);

export { makeDateUtils, timeToMin };

export function getMondayUTC(offsetWeeks = 0): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const daysToMon = day === 0 ? -6 : 1 - day;
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysToMon + offsetWeeks * 7,
    ),
  );
}

export const toSlug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function uploadSeedTaskImage(
  orgSlug: string,
  taskSlug: string,
  keyword: string,
): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const storagePath = `seed/${orgSlug}/tasks/${taskSlug}.jpg`;
  const authHeader = { Authorization: `Bearer ${supabaseKey}` };

  try {
    const infoRes = await fetch(
      `${supabaseUrl}/storage/v1/object/info/friendchise-private/${storagePath}`,
      { headers: authHeader },
    );
    if (infoRes.ok) return storagePath;

    const tryFetch = (kw: string) => fetch(`https://loremflickr.com/800/600/${kw}/all`);
    let imgRes = await tryFetch(keyword);
    if (!imgRes.ok) imgRes = await tryFetch("bakery,food,donut");
    if (!imgRes.ok) return null;
    const imgData = await imgRes.arrayBuffer();

    const uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/friendchise-private/${storagePath}`,
      {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "image/jpeg" },
        body: imgData,
      },
    );
    return uploadRes.ok ? storagePath : null;
  } catch {
    return null;
  }
}

export async function uploadOrgLogo(
  orgSlug: string,
  imageBuffer: Buffer,
): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const storagePath = `seed/${orgSlug}/logo.jpg`;
  const authHeader = { Authorization: `Bearer ${supabaseKey}` };

  try {
    const infoRes = await fetch(
      `${supabaseUrl}/storage/v1/object/info/friendchise-public/${storagePath}`,
      { headers: authHeader },
    );
    if (infoRes.ok) return storagePath;

    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/friendchise-public/${storagePath}`,
      {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "image/jpeg" },
        body: imageBuffer as unknown as BodyInit,
      },
    );
    return res.ok ? storagePath : null;
  } catch {
    return null;
  }
}
