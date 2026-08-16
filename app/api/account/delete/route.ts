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
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null) {
      return NextResponse.json(
        { error: "Confirmation text is required" },
        { status: 400 },
      );
    }

    body = parsed as DeleteAccountBody;
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

    const error = status === 500 ? "Failed to delete account" : result.error;

    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ ok: true });
}