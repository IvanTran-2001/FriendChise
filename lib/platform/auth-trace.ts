/**
 * Temporary diagnostics for the mobile OAuth redirect-chain investigation.
 * Logs cookie PRESENCE only (never values) so session/CSRF/PKCE state can be
 * correlated across requests without leaking secrets.
 */
const TRACE_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.callback-url",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "authjs.pkce.code_verifier",
  "__Secure-authjs.pkce.code_verifier",
  "authjs.state",
  "__Secure-authjs.state",
] as const;

export function traceCookiePresence(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  const cookiePairs = header
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const present: Record<string, boolean> = {};
  for (const name of TRACE_COOKIE_NAMES) {
    present[name] = cookiePairs.some((entry) => entry === name || entry.startsWith(`${name}=`));
  }
  return present;
}

export function authLogPrefix(attemptId: string | null, stage: string) {
  return `[AUTH ${attemptId ?? "unknown"}][${stage}]`;
}
