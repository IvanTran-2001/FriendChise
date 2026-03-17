import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { createOrgSchema } from "@/lib/validators/org";
import { createOrg } from "@/lib/services/orgs";

export async function POST(req: Request) {
  const authz = await requireUser();
  if (!authz.ok) return authz.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createOrgSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await createOrg(authz.userId, parsed.data);
  return NextResponse.json(result, { status: 201 });
}
