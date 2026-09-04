import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/platform/prisma";
import { verifyAppleIdentityToken } from "@/lib/platform/apple-jwt";

const MOBILE_TOKEN_COOKIE_NAME = "friendchise.mobile-session-token";
const MOBILE_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const APPLE_MOBILE_CLIENT_ID = process.env.AUTH_APPLE_MOBILE_CLIENT_ID?.trim();
const AUTH_SECRET = process.env.AUTH_SECRET?.trim();

type AppleLoginBody = {
  identityToken: string;
  authorizationCode?: string;
  email?: string | null;
  displayName?: string | null;
  attemptId?: string | null;
};

function normalizeDisplayName(displayName?: string | null) {
  const value = displayName?.trim();
  return value ? value : null;
}

async function readRequestBody(request: Request): Promise<AppleLoginBody | null> {
  try {
    return (await request.json()) as AppleLoginBody;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!APPLE_MOBILE_CLIENT_ID) {
    return NextResponse.json({ error: "AUTH_APPLE_MOBILE_CLIENT_ID not set" }, { status: 500 });
  }
  if (!AUTH_SECRET) {
    return NextResponse.json({ error: "AUTH_SECRET not set" }, { status: 500 });
  }

  const body = await readRequestBody(request);
  if (!body?.identityToken) {
    return NextResponse.json({ error: "identityToken required" }, { status: 400 });
  }

  let claims;
  try {
    claims = await verifyAppleIdentityToken(body.identityToken, APPLE_MOBILE_CLIENT_ID);
  } catch (error) {
    console.error("[mobile-auth/apple] Apple identity token verification failed", error);
    return NextResponse.json({ error: "Invalid Apple identity token" }, { status: 401 });
  }

  const appleSubject = claims.sub;
  if (!appleSubject) {
    return NextResponse.json({ error: "Apple identity token subject missing" }, { status: 401 });
  }

  const appleEmail = claims.email?.trim().toLowerCase();
  if (!appleEmail) {
    return NextResponse.json({ error: "Apple identity token email missing" }, { status: 401 });
  }

  const appleEmailVerified = claims.email_verified === true || claims.email_verified === "true";
  if (!appleEmailVerified) {
    return NextResponse.json({ error: "Apple identity token email is not verified" }, { status: 401 });
  }

  const displayName = normalizeDisplayName(body.displayName);
  const now = new Date();

  const user = await prisma.$transaction(async (tx) => {
    const account = await tx.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "apple",
          providerAccountId: appleSubject,
        },
      },
      select: { userId: true },
    });

    let existingUser = account
      ? await tx.user.findUnique({
          where: { id: account.userId },
          select: { id: true, email: true, name: true, image: true, emailVerified: true },
        })
      : null;

      if (!existingUser) {
      existingUser = await tx.user.findUnique({
        where: { email: appleEmail },
        select: { id: true, email: true, name: true, image: true, emailVerified: true },
      });
    }

    if (!existingUser) {
      existingUser = await tx.user.create({
        data: {
          email: appleEmail,
          name: displayName,
          emailVerified: now,
        },
        select: { id: true, email: true, name: true, image: true, emailVerified: true },
      });
    } else {
      const updates: { emailVerified?: Date; name?: string | null } = {};
      if (!existingUser.emailVerified) {
        updates.emailVerified = now;
      }
      if (!existingUser.name && displayName) {
        updates.name = displayName;
      }

      if (Object.keys(updates).length > 0) {
        existingUser = await tx.user.update({
          where: { id: existingUser.id },
          data: updates,
          select: { id: true, email: true, name: true, image: true, emailVerified: true },
        });
      }
    }

    await tx.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "apple",
          providerAccountId: appleSubject,
        },
      },
      create: {
        userId: existingUser.id,
        type: "oauth",
        provider: "apple",
        providerAccountId: appleSubject,
        id_token: body.identityToken,
        token_type: "id_token",
      },
      update: {
        userId: existingUser.id,
        type: "oauth",
        id_token: body.identityToken,
        token_type: "id_token",
      },
    });

    return existingUser;
  });

  const expiresAt = Date.now() + MOBILE_SESSION_MAX_AGE_SECONDS * 1000;
  const token = await encode({
    token: {
      sub: user.id,
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      picture: user.image ?? undefined,
    },
    secret: AUTH_SECRET,
    salt: MOBILE_TOKEN_COOKIE_NAME,
    maxAge: MOBILE_SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({
    token,
    expiresAt,
    attemptId: body.attemptId ?? undefined,
  });
}