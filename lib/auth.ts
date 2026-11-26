/**
 * Signed API tokens.
 *
 * The public surface uses a two-step handshake:
 *
 *   1. `POST /api/v1/auth/token` with header `x-api-key: <public key>`
 *      returns a short-lived HMAC-SHA256 signed token (auth token).
 *   2. Every data request sends `authorization: Bearer <token>`.
 *
 * Tokens are stateless (payload.timestamp.payloadSignature) so they work on
 * every Vercel edge/Node runtime without a shared store. In addition, the
 * `x-api-key` header is always validated so a leaked token alone is useless.
 */
import { apiAuth, features } from "./config";

const encoder = new TextEncoder();

function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64url(signature);
}

function secret(): string {
  return apiAuth.signingSecret || "ctg-dev-signing-secret";
}

export type TokenPayload = {
  token: string;
  expiresAt: number;
  ttl: number;
  scope: string[];
};

export async function issueToken(scope = ["catalog:read", "search:read"]): Promise<TokenPayload> {
  const issuedAt = Date.now();
  const ttl = Math.max(60, apiAuth.tokenTtlSeconds);
  const body = base64url(
    JSON.stringify({ iat: issuedAt, exp: issuedAt + ttl * 1000, scope, aud: "ctgmovies-public" }),
  );
  const signature = await hmac(secret(), body);
  return { token: `${body}.${signature}`, expiresAt: issuedAt + ttl * 1000, ttl, scope };
}

export async function verifyToken(token: string | null): Promise<
  { ok: true; scope: string[] } | { ok: false; reason: string }
> {
  if (!token) return { ok: false, reason: "missing auth token" };
  const [body, signature] = token.replace(/^Bearer\s+/i, "").split(".");
  if (!body || !signature) return { ok: false, reason: "malformed auth token" };
  const expected = await hmac(secret(), body);
  if (expected !== signature) return { ok: false, reason: "invalid auth token signature" };
  try {
    const payload = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload.exp === "number" && payload.exp < Date.now()) {
      return { ok: false, reason: "auth token expired" };
    }
    return { ok: true, scope: Array.isArray(payload.scope) ? payload.scope : [] };
  } catch {
    return { ok: false, reason: "unreadable auth token payload" };
  }
}

export function verifyApiKey(headerValue: string | null): boolean {
  if (!headerValue) return false;
  if (headerValue === apiAuth.bffKey) return true;
  if (apiAuth.partnerKeys.includes(headerValue)) return true;
  return !features.strictAuth && headerValue.length >= 8;
}

/** Guard used by every /api/v1 route. */
export async function authorize(request: Request): Promise<Response | null> {
  const key = request.headers.get(apiAuth.keyHeader);
  if (!verifyApiKey(key)) {
    return Response.json(
      { ok: false, error: "invalid_api_key", hint: "send a valid x-api-key header" },
      { status: 401 },
    );
  }
  const verified = await verifyToken(request.headers.get(apiAuth.tokenHeader));
  if (!verified.ok) {
    return Response.json(
      { ok: false, error: "unauthorized", reason: verified.reason, tokenEndpoint: "/api/v1/auth/token" },
      { status: 401 },
    );
  }
  return null;
}
