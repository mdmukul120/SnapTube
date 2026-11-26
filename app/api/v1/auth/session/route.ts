import { issueToken, verifyApiKey, verifyToken } from "@/lib/auth";
import { apiAuth } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single-call session bootstrap for the browser: the key + token are exchanged
 * server-side so the signed secret never leaves the deployment.
 */
export async function POST(request: Request) {
  const key = request.headers.get(apiAuth.keyHeader);
  if (!verifyApiKey(key)) {
    return Response.json({ ok: false, error: "invalid_api_key" }, { status: 401 });
  }
  const existing = request.headers.get(apiAuth.tokenHeader);
  if (existing) {
    const checked = await verifyToken(existing);
    if (checked.ok) {
      return Response.json({ ok: true, reused: true, token: existing.replace(/^Bearer\s+/i, ""), scope: checked.scope });
    }
  }
  const payload = await issueToken();
  return Response.json({ ok: true, reused: false, tokenType: "Bearer", ...payload });
}
