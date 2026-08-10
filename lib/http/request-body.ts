import { NextResponse } from "next/server";

type ParseRequestBodyOptions = {
  multipart?: boolean;
};

export async function parseRequestBody(req: Request, options: ParseRequestBodyOptions = {}) {
  const contentType = req.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const isForm = contentType.includes("application/x-www-form-urlencoded");
  const isMultipart = options.multipart && contentType.includes("multipart/form-data");

  if (!isJson && !isForm && !isMultipart) {
    return NextResponse.json({ error: "Unsupported media type." }, { status: 415 });
  }

  if (isJson) {
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
      }

      return parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
    }
  }

  if (isMultipart) {
    try {
      return await req.formData();
    } catch {
      return NextResponse.json({ error: "Malformed form body." }, { status: 400 });
    }
  }

  try {
    const text = await req.text();
    const parsed: Record<string, unknown> = {};
    for (const [key, value] of new URLSearchParams(text).entries()) {
      const existing = parsed[key];
      if (existing === undefined) {
        parsed[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        parsed[key] = [existing, value];
      }
    }

    return parsed;
  } catch {
    return NextResponse.json({ error: "Malformed form body." }, { status: 400 });
  }
}

export function getStringField(body: Record<string, unknown> | FormData, key: string) {
  const value = body instanceof FormData ? body.get(key) : body[key];
  return typeof value === "string" ? value : undefined;
}