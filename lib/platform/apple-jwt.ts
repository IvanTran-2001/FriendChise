const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_JWKS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type AppleIdentityTokenHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type AppleJwk = JsonWebKey & {
  kid: string;
};

export type AppleIdentityTokenClaims = {
  iss?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
};

let cachedJwks: AppleJwk[] | null = null;
let cachedJwksAt = 0;

function decodeBase64UrlJson<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

function decodeBase64UrlBytes(segment: string) {
  return Buffer.from(segment, "base64url");
}

async function getAppleJwks(forceRefresh = false) {
  if (!forceRefresh && cachedJwks && Date.now() - cachedJwksAt < APPLE_JWKS_CACHE_TTL_MS) {
    return cachedJwks;
  }

  const response = await fetch(APPLE_JWKS_URL);
  if (!response.ok) {
    throw new Error(`Failed to load Apple signing keys: ${response.status}`);
  }

  const body = (await response.json()) as { keys?: AppleJwk[] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error("Apple signing keys response was empty");
  }

  cachedJwks = body.keys;
  cachedJwksAt = Date.now();
  return cachedJwks;
}

export async function verifyAppleIdentityToken(identityToken: string, expectedAudience: string) {
  const [headerSegment, payloadSegment, signatureSegment] = identityToken.split(".");
  if (!headerSegment || !payloadSegment || !signatureSegment) {
    throw new Error("Apple identity token is malformed");
  }

  const header = decodeBase64UrlJson<AppleIdentityTokenHeader>(headerSegment);
  const payload = decodeBase64UrlJson<AppleIdentityTokenClaims>(payloadSegment);

  // Apple signs identity tokens with RS256 (RSA); its published JWKS are RSA keys, not EC.
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Apple identity token uses an unsupported signature algorithm");
  }

  if (payload.iss !== APPLE_ISSUER) {
    throw new Error("Apple identity token issuer is invalid");
  }

  if (payload.aud !== expectedAudience) {
    throw new Error("Apple identity token audience is invalid");
  }

  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Apple identity token subject is missing");
  }

  if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("Apple identity token is expired");
  }

  const signingInput = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
  const signature = decodeBase64UrlBytes(signatureSegment);

  let jwk = (await getAppleJwks()).find((key) => key.kid === header.kid) ?? null;
  if (!jwk) {
    jwk = (await getAppleJwks(true)).find((key) => key.kid === header.kid) ?? null;
  }

  if (!jwk) {
    throw new Error("Apple signing key not found");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signature,
    signingInput,
  );

  if (!verified) {
    throw new Error("Apple identity token signature is invalid");
  }

  return payload;
}