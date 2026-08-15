import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { deleteUserAccount } from "@/lib/services/users";

type DeleteAccountBody = {
  confirmText?: string;
};

export async function DELETE(request: Request) {
  const authz = await requireUser();
  if (!authz.ok) return authz.response;

  let body: DeleteAccountBody = {};
  try {
    body = (await request.json()) as DeleteAccountBody;
  } catch {
    return NextResponse.json(
      { error: "Confirmation text is required" },
      { status: 400 },
    );
  }

  const confirmText = typeof body.confirmText === "string" ? body.confirmText.trim() : "";
  if (!confirmText) {
    return NextResponse.json(
      { error: "Confirmation text is required" },
      { status: 400 },
    );
  }

  const result = await deleteUserAccount(authz.userId, confirmText);
  if (!result.ok) {
    const status =
      result.error === "User not found"
        ? 404
        : result.error === "Confirmation text does not match"
          ? 400
          : 500;

    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}