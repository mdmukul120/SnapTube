import { issueToken, verifyApiKey } from "@/lib/auth";
import { apiAuth } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cors(init: ResponseInit = {}) {
  return {
    ...init,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, x-api-key, content-type",
      "cache-control": "no-store",
      ...(init.headers ?? {}),
    },
  };
}

export async function OPTIONS() {
  return new Response(null, cors({ status: 204 }));
}

/**
 * Step 1 of the handshake.
 *
 *   curl -X POST /api/v1/auth/token -H "x-api-key: $NEXT_PUBLIC_BFF_API_KEY"
 *
 * Response: { ok, token, tokenType: "Bearer", expiresAt, ttl, scope }
 */
export async function POST(request: Request) {
  const key = request.headers.get(apiAuth.keyHeader);
  if (!verifyApiKey(key)) {
    return Response.json(
      {
        ok: false,
        error: "invalid_api_key",
        message: "Send a valid x-api-key header to mint an auth token.",
      },
      cors({ status: 401 }),
    );
  }
  const payload = await issueToken();
  return Response.json(
    { ok: true, tokenType: "Bearer", ...payload },
    cors({ status: 200 }),
  );
}

export async function GET() {
  return Response.json(
    {
      ok: false,
      error: "method_not_allowed",
      message: "Mint a token with POST and a valid x-api-key header.",
      example: 'curl -X POST /api/v1/auth/token -H "x-api-key: <key>"',
    },
    cors({ status: 405 }),
  );
}
