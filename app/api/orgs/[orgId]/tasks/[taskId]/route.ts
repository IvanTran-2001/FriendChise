import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/authz";
import { getAccessibleTaskById } from "@/lib/services/tasks";
import { createSignedReadUrl } from "@/lib/platform/supabase-storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; taskId: string }> },
) {
  const { orgId, taskId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const accessible = await getAccessibleTaskById(orgId, taskId);
  if (!accessible) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const imageSignedUrl = accessible.task.imageUrl
    ? await createSignedReadUrl(accessible.task.imageUrl)
    : null;

  return NextResponse.json({
    task: {
      ...accessible.task,
      imageSignedUrl,
      isOwner: accessible.isOwner,
    },
  });
}
