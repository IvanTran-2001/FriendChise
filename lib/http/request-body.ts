import { NextResponse } from "next/server";

export async function parseRequestBody(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const isForm = contentType.includes("application/x-www-form-urlencoded");

  if (!isJson && !isForm) {
    return NextResponse.json({ error: "Unsupported media type." }, { status: 415 });
  }

  if (isJson) {
    try {
      return ((await req.json()) as Record<string, unknown> | null) ?? {};
    } catch {
      return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
    }
  }

  try {
    const text = await req.text();
    return Object.fromEntries(new URLSearchParams(text).entries()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Malformed form body." }, { status: 400 });
  }
}