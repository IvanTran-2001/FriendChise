import { NextResponse } from "next/server";
import { getDevUsers } from "@/app/(auth)/signin/get-dev-users";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(getDevUsers());
}