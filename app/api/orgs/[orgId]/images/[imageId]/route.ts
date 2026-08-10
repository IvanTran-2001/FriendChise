import { NextResponse } from "next/server";
import { deleteOrgImageAction } from "@/app/actions/storage";
import { storageErrorStatus } from "@/lib/http/storage-error";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string; imageId: string }> },
) {
  const { orgId, imageId } = await params;

  const result = await deleteOrgImageAction(orgId, imageId);
  if (!result.ok) {
    const status = result.error === "Unauthorized" ? 403 : storageErrorStatus(result.code);
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}